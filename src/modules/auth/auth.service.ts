import { compare, hash } from 'bcryptjs';

import { prisma } from '../../config/prisma.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsError';
  }
}

export class InvalidRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRegistrationError';
  }
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('An account with this email already exists.');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthenticatedUser> {
    const name = this.parseName(input.name);
    const email = this.parseEmail(input.email);
    this.validatePassword(input.password);

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await hash(input.password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    return this.toAuthenticatedUser(user);
  }

  async login(input: LoginInput): Promise<AuthenticatedUser> {
    const email = this.parseEmail(input.email);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await compare(input.password, user.passwordHash))) {
      throw new InvalidCredentialsError();
    }

    return this.toAuthenticatedUser(user);
  }

  private parseName(value: string): string {
    const name = value.trim();

    if (name.length < 2 || name.length > 100) {
      throw new InvalidRegistrationError('name must contain between 2 and 100 characters.');
    }

    return name;
  }

  private parseEmail(value: string): string {
    const email = value.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      throw new InvalidRegistrationError('email must be valid.');
    }

    return email;
  }

  private validatePassword(value: string): void {
    if (value.length < MIN_PASSWORD_LENGTH) {
      throw new InvalidRegistrationError(
        `password must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }
  }

  private toAuthenticatedUser(user: {
    id: string;
    name: string;
    email: string;
  }): AuthenticatedUser {
    return { id: user.id, name: user.name, email: user.email };
  }
}