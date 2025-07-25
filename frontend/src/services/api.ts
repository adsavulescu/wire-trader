import axios, { type AxiosInstance, type AxiosResponse, type AxiosError } from 'axios'
import type { ApiResponse, ApiError } from '@/types'

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('wire-trader-token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor to handle common errors
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response
      },
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('wire-trader-token')
          window.location.href = '/login'
        }
        return Promise.reject(this.handleError(error))
      }
    )
  }

  private handleError(error: AxiosError): ApiError {
    if (error.response) {
      // Server responded with error status
      return {
        message: (error.response.data as any)?.message || 'Server error occurred',
        code: (error.response.data as any)?.code,
        status: error.response.status,
      }
    } else if (error.request) {
      // Request was made but no response received
      return {
        message: 'Network error - please check your connection',
        code: 'NETWORK_ERROR',
      }
    } else {
      // Something happened in setting up the request
      return {
        message: error.message || 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
      }
    }
  }

  async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get(url, { params })
      return {
        success: true,
        data: response.data,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as ApiError).message,
      }
    }
  }

  async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post(url, data)
      return {
        success: true,
        data: response.data,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as ApiError).message,
      }
    }
  }

  async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put(url, data)
      return {
        success: true,
        data: response.data,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as ApiError).message,
      }
    }
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete(url)
      return {
        success: true,
        data: response.data,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as ApiError).message,
      }
    }
  }
}

export const apiService = new ApiService()
export default apiService