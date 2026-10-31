import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config/app.config";

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.security.bcryptRounds);
}

// Compare password with hash
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
export function generateToken(userId: number, username: string): string {
  return jwt.sign(
    { userId, username },
    config.security.jwtSecret,
    { expiresIn: "7d" }
  );
}

// Verify JWT token
export function verifyToken(token: string): { userId: number; username: string } | null {
  try {
    const decoded = jwt.verify(token, config.security.jwtSecret) as {
      userId: number;
      username: string;
    };
    return decoded;
  } catch (error) {
    return null;
  }
}

// Extract token from Authorization header
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}
