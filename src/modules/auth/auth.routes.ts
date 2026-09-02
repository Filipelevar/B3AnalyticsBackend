import type { FastifyInstance } from 'fastify';

import {
  AuthService,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidRegistrationError,
} from './auth.service.js';

interface RegisterBody {
  name?: string;
  email?: string;
  password?: string;
}

interface LoginBody {
  email?: string;
  password?: string;
}

const authService = new AuthService();

export async function registerAuthRoutes(server: FastifyInstance): Promise<void> {
  server.post<{ Body: RegisterBody }>('/auth/register', async (request, reply) => {
    const { name, email, password } = request.body ?? {};

    if (!name || !email || !password) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'name, email and password are required.',
      });
    }

    try {
      const user = await authService.register({ name, email, password });
      const token = await reply.jwtSign({ sub: user.id, email: user.email }, { expiresIn: '1h' });

      return reply.status(201).send({ user, token });
    } catch (error) {
      if (error instanceof InvalidRegistrationError) {
        return reply.status(400).send({ error: 'Bad Request', message: error.message });
      }

      if (error instanceof EmailAlreadyRegisteredError) {
        return reply.status(409).send({ error: 'Conflict', message: error.message });
      }

      request.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred.',
      });
    }
  });

  server.post<{ Body: LoginBody }>('/auth/login', async (request, reply) => {
    const { email, password } = request.body ?? {};

    if (!email || !password) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'email and password are required.',
      });
    }

    try {
      const user = await authService.login({ email, password });
      const token = await reply.jwtSign({ sub: user.id, email: user.email }, { expiresIn: '1h' });

      return { user, token };
    } catch (error) {
      if (error instanceof InvalidRegistrationError || error instanceof InvalidCredentialsError) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid email or password.' });
      }

      request.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred.',
      });
    }
  });
}