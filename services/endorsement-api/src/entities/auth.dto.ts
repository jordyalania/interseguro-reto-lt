import Joi from 'joi';

export interface LoginRequestDto {
  username: string;
  password: string;
}

export interface LoginResponseDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export const loginRequestSchema = Joi.object({
  username: Joi.string().max(100).required(),
  password: Joi.string().max(200).required(),
}).label('login');
