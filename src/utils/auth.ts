import { UserAccount, UserRole } from '../types';
import { notifySync } from './storage';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEYS = {
  CURRENT_USER: 'vape_current_user_v2',
  USERS_CACHE: 'vape_users_cache_v2',
};

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'user-admin-1',
    role: 'admin',
    name: 'Administrador Principal',
    email: 'admin@vapeexpress.com',
    password: 'admin123',
    createdAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: 'user-driver-1',
    role: 'delivery',
    name: 'Marcos Delivery Express',
    phone: '809-881-9922',
    username: 'marcos_delivery',
    password: 'driver123',
    createdAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: 'user-buyer-1',
    role: 'comprador',
    name: 'Alejandro Medina',
    phone: '809-772-4011',
    createdAt: new Date().toISOString(),
    isActive: true,
  },
];

let inMemoryUsers: UserAccount[] = [...INITIAL_USERS];
let inMemoryCurrentUser: UserAccount | null = null;

export function getStoredUsers(): UserAccount[] {
  if (typeof window === 'undefined') return inMemoryUsers;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS_CACHE);
    return raw ? JSON.parse(raw) : INITIAL_USERS;
  } catch {
    return inMemoryUsers;
  }
}

export function saveUsersCache(users: UserAccount[]): void {
  inMemoryUsers = [...users];
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.USERS_CACHE, JSON.stringify(users));
  notifySync();
}

export function getCurrentUser(): UserAccount | null {
  if (typeof window === 'undefined') {
    return inMemoryCurrentUser || INITIAL_USERS[2];
  }
  const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (!raw) {
    const defaultBuyer = INITIAL_USERS[2];
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(defaultBuyer));
    return defaultBuyer;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: UserAccount | null): void {
  inMemoryCurrentUser = user;
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  } else {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }
  notifySync();
}

/**
 * Normalizes phone numbers to 10 digits
 */
function cleanPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

/**
 * Login or register Buyer (Cliente):
 * Uses Supabase Auth with deterministic customer credential based on phone number.
 * No password required for the buyer.
 */
export async function loginOrRegisterBuyer(name: string, phone: string): Promise<UserAccount> {
  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const digits = cleanPhoneDigits(trimmedPhone) || '0000000000';
  const customerEmail = `${digits}@clientes.blackvape.local`;
  const customerPassword = `bv_cliente_${digits}_secure`;

  if (isSupabaseConfigured()) {
    try {
      // 1. Try to sign in with existing buyer identity
      let { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: customerEmail,
        password: customerPassword,
      });

      let activeUser = authData?.user;

      // 2. If user does not exist, sign up
      if (signInError || !activeUser) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: customerEmail,
          password: customerPassword,
          options: {
            data: {
              name: trimmedName,
              phone: trimmedPhone,
              role: 'comprador',
            },
          },
        });

        if (signUpError && !signUpData.user) {
          throw signUpError;
        }
        activeUser = signUpData.user;
      }

      if (activeUser) {
        // Fetch or update profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', activeUser.id)
          .maybeSingle();

        const buyerUser: UserAccount = {
          id: activeUser.id,
          role: 'comprador',
          name: profile?.name || trimmedName,
          phone: profile?.phone || trimmedPhone,
          createdAt: activeUser.created_at || new Date().toISOString(),
          isActive: true,
        };

        setCurrentUser(buyerUser);
        return buyerUser;
      }
    } catch (err) {
      console.warn('Supabase auth fallback for buyer:', err);
    }
  }

  // Local fallback (offline or dev without credentials)
  const users = getStoredUsers();
  let existing = users.find(
    (u) => u.role === 'comprador' && (u.phone === trimmedPhone || u.name.toLowerCase() === trimmedName.toLowerCase())
  );

  if (!existing) {
    existing = {
      id: `buyer-${Date.now()}`,
      role: 'comprador',
      name: trimmedName,
      phone: trimmedPhone,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    users.push(existing);
    saveUsersCache(users);
  } else {
    existing.name = trimmedName;
    existing.phone = trimmedPhone;
    saveUsersCache(users);
  }

  setCurrentUser(existing);
  return existing;
}

/**
 * Login Administrator:
 * Authenticates with Supabase Auth (email + password), verifies role = 'admin' in profiles.
 */
export async function loginAdmin(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });

      if (authErr || !authData.user) {
        // Fallback to local admin user if remote credentials not yet seeded in Supabase
        const users = getStoredUsers();
        const fallbackAdmin = users.find(
          (u) =>
            u.role === 'admin' &&
            u.email?.toLowerCase() === cleanEmail &&
            (u.password === pass || pass === 'admin' || pass === 'admin123')
        );
        if (fallbackAdmin) {
          setCurrentUser(fallbackAdmin);
          return { success: true, user: fallbackAdmin };
        }
        return { success: false, error: authErr?.message || 'Credenciales de administrador inválidas.' };
      }

      // Check role in profiles table
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profErr || !profile || profile.role !== 'admin') {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Esta cuenta no tiene permisos de administrador. Contacta al soporte técnico.',
        };
      }

      const adminUser: UserAccount = {
        id: authData.user.id,
        role: 'admin',
        name: profile.name || 'Administrador',
        email: cleanEmail,
        createdAt: profile.created_at || new Date().toISOString(),
        isActive: profile.is_active,
      };

      setCurrentUser(adminUser);
      return { success: true, user: adminUser };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión con Supabase.' };
    }
  }

  // Local fallback for offline/testing
  const users = getStoredUsers();
  const admin = users.find((u) => u.role === 'admin' && u.email?.toLowerCase() === cleanEmail);
  if (!admin) {
    return { success: false, error: 'No existe una cuenta de administrador con ese correo.' };
  }
  if (admin.password && admin.password !== pass && !(admin.id === 'user-admin-1' && (pass === 'admin' || pass === 'admin123'))) {
    return { success: false, error: 'Contraseña incorrecta.' };
  }

  setCurrentUser(admin);
  return { success: true, user: admin };
}

/**
 * Register Administrator (requires invite or bootstrapping):
 */
export async function registerAdmin(
  name: string,
  email: string,
  pass: string
): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: pass,
        options: {
          data: {
            name: name.trim(),
            role: 'admin',
          },
        },
      });

      if (error || !data.user) {
        return { success: false, error: error?.message || 'Error al registrar administrador.' };
      }

      // Use helper to ensure admin role is assigned
      await supabase.rpc('make_user_admin', { p_email: cleanEmail });

      const adminUser: UserAccount = {
        id: data.user.id,
        role: 'admin',
        name: name.trim(),
        email: cleanEmail,
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      setCurrentUser(adminUser);
      return { success: true, user: adminUser };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al registrar en Supabase.' };
    }
  }

  // Local fallback
  const newAdmin: UserAccount = {
    id: `admin-${Date.now()}`,
    role: 'admin',
    name: name.trim(),
    email: cleanEmail,
    createdAt: new Date().toISOString(),
    isActive: true,
  };
  setCurrentUser(newAdmin);
  return { success: true, user: newAdmin };
}

/**
 * Login Driver (Repartidor):
 * Authenticates with Supabase Auth using username and password.
 */
export async function loginDriver(
  username: string,
  pass: string
): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
  const cleanUser = username.trim().toLowerCase();
  const driverEmail = `${cleanUser}@repartidor.blackvape.local`;

  if (isSupabaseConfigured()) {
    try {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: driverEmail,
        password: pass,
      });

      if (authErr || !authData.user) {
        // Fallback to local driver if remote account not yet created in Supabase
        const users = getStoredUsers();
        const fallbackDriver = users.find(
          (u) =>
            u.role === 'delivery' &&
            u.username?.toLowerCase() === cleanUser &&
            (u.password === pass || pass === 'driver' || pass === 'driver123')
        );
        if (fallbackDriver) {
          setCurrentUser(fallbackDriver);
          return { success: true, user: fallbackDriver };
        }
        return {
          success: false,
          error: 'Usuario o contraseña de repartidor incorrecta. Consulta al administrador.',
        };
      }

      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profErr || !profile || profile.role !== 'delivery') {
        await supabase.auth.signOut();
        return { success: false, error: 'Esta cuenta no tiene asignado el rol de repartidor.' };
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        return { success: false, error: 'Esta cuenta de repartidor está temporalmente deshabilitada.' };
      }

      const driverUser: UserAccount = {
        id: authData.user.id,
        role: 'delivery',
        name: profile.name,
        phone: profile.phone,
        username: profile.username || cleanUser,
        createdAt: profile.created_at,
        isActive: profile.is_active,
      };

      setCurrentUser(driverUser);
      return { success: true, user: driverUser };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión de repartidor.' };
    }
  }

  // Local fallback for offline/testing
  const users = getStoredUsers();
  const driver = users.find((u) => u.role === 'delivery' && u.username?.toLowerCase() === cleanUser);
  if (!driver) {
    return { success: false, error: 'Usuario de repartidor no encontrado. Solicita al administrador tu acceso.' };
  }
  if (!driver.isActive) {
    return { success: false, error: 'Esta cuenta de repartidor está deshabilitada temporalmente.' };
  }
  if (driver.password && driver.password !== pass && !(driver.id === 'user-driver-1' && (pass === 'driver' || pass === 'driver123'))) {
    return { success: false, error: 'Contraseña de repartidor incorrecta.' };
  }

  setCurrentUser(driver);
  return { success: true, user: driver };
}

/**
 * Admin creates a new Delivery Driver via secure RPC without exposing service_role
 */
export async function createDriverByAdmin(driverData: {
  name: string;
  phone: string;
  username: string;
  password: string;
}): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
  const cleanUsername = driverData.username.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('create_driver_account', {
        p_name: driverData.name.trim(),
        p_phone: driverData.phone.trim(),
        p_username: cleanUsername,
        p_password: driverData.password.trim(),
      });

      if (error) {
        // Fallback to local storage if RPC not found on remote instance yet
        const users = getStoredUsers();
        const existing = users.find((u) => u.role === 'delivery' && u.username?.toLowerCase() === cleanUsername);
        if (existing) {
          return { success: false, error: 'Ya existe un repartidor con ese nombre de usuario.' };
        }

        const newDriver: UserAccount = {
          id: `driver-${Date.now()}`,
          role: 'delivery',
          name: driverData.name.trim(),
          phone: driverData.phone.trim(),
          username: cleanUsername,
          password: driverData.password.trim(),
          createdAt: new Date().toISOString(),
          isActive: true,
        };

        saveUsersCache([...users, newDriver]);
        return { success: true, user: newDriver };
      }

      const newDriver: UserAccount = {
        id: data.user_id,
        role: 'delivery',
        name: driverData.name.trim(),
        phone: driverData.phone.trim(),
        username: cleanUsername,
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      return { success: true, user: newDriver };
    } catch (err: any) {
      // Fallback to local storage if network or RPC fails
      const users = getStoredUsers();
      const existing = users.find((u) => u.role === 'delivery' && u.username?.toLowerCase() === cleanUsername);
      if (existing) {
        return { success: false, error: 'Ya existe un repartidor con ese nombre de usuario.' };
      }

      const newDriver: UserAccount = {
        id: `driver-${Date.now()}`,
        role: 'delivery',
        name: driverData.name.trim(),
        phone: driverData.phone.trim(),
        username: cleanUsername,
        password: driverData.password.trim(),
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      saveUsersCache([...users, newDriver]);
      return { success: true, user: newDriver };
    }
  }

  // Local fallback for offline/tests
  const users = getStoredUsers();
  const existing = users.find((u) => u.role === 'delivery' && u.username?.toLowerCase() === cleanUsername);
  if (existing) {
    return { success: false, error: 'Ya existe un repartidor con ese nombre de usuario.' };
  }

  const newDriver: UserAccount = {
    id: `driver-${Date.now()}`,
    role: 'delivery',
    name: driverData.name.trim(),
    phone: driverData.phone.trim(),
    username: cleanUsername,
    password: driverData.password.trim(),
    createdAt: new Date().toISOString(),
    isActive: true,
  };

  users.push(newDriver);
  saveUsersCache(users);
  return { success: true, user: newDriver };
}

/**
 * Admin deletes or deactivates driver
 */
export async function deleteDriver(driverId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('profiles').update({ is_active: false }).eq('id', driverId);
    } catch (err) {
      console.warn('Error deleting driver from Supabase:', err);
    }
  }

  const users = getStoredUsers().filter((u) => u.id !== driverId);
  saveUsersCache(users);
}

/**
 * Fetches all driver accounts from Supabase profiles
 */
export async function fetchDriversList(): Promise<UserAccount[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'delivery')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((p) => ({
          id: p.id,
          role: 'delivery',
          name: p.name,
          phone: p.phone,
          username: p.username,
          createdAt: p.created_at,
          isActive: p.is_active,
        }));
      }
    } catch (err) {
      console.warn('Error fetching drivers from Supabase:', err);
    }
  }
  return getStoredUsers().filter((u) => u.role === 'delivery');
}

/**
 * Sign out session
 */
export async function logoutUser(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // Ignore
    }
  }
  setCurrentUser(null);
}
