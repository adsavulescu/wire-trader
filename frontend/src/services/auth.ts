import apiService from './api'
import type { AuthResponse, LoginCredentials, RegisterCredentials, User, ApiResponse } from '@/types'

export class AuthService {
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
    return await apiService.post<AuthResponse>('/auth/login', credentials)
  }

  async register(credentials: RegisterCredentials): Promise<ApiResponse<AuthResponse>> {
    return await apiService.post<AuthResponse>('/auth/register', credentials)
  }

  async getProfile(): Promise<ApiResponse<User>> {
    return await apiService.get<User>('/auth/me')
  }

  async logout(): Promise<ApiResponse<void>> {
    return await apiService.post<void>('/auth/logout')
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    return await apiService.post<{ token: string }>('/auth/refresh')
  }

  setToken(token: string): void {
    localStorage.setItem('wire-trader-token', token)
  }

  getToken(): string | null {
    return localStorage.getItem('wire-trader-token')
  }

  removeToken(): void {
    localStorage.removeItem('wire-trader-token')
  }

  isTokenValid(): boolean {
    const token = this.getToken()
    if (!token) return false

    try {
      // Basic JWT token validation (check if not expired)
      const payload = JSON.parse(atob(token.split('.')[1]))
      const now = Date.now() / 1000
      return payload.exp > now
    } catch {
      return false
    }
  }
}

export const authService = new AuthService()
export default authService