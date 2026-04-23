import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../database/prisma.js';

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, platform_id: user.platform_id },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

export async function login(username, password) {
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !user.is_active) {
    throw new Error('Invalid username or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid username or password');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      user_id: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      platform_id: user.platform_id,
    },
  };
}

export async function refresh(refreshToken) {
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expires_at < new Date()) {
    throw new Error('Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || !user.is_active) {
    throw new Error('User not found or inactive');
  }

  const accessToken = generateAccessToken(user);
  return { accessToken };
}

export async function logout(refreshToken) {
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
}