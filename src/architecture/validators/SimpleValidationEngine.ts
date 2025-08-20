/**
 * Движок валидации
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class SimpleValidationEngine {
  /**
   * Валидация email
   */
  static validateEmail(email: string): ValidationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    
    return {
      isValid,
      errors: isValid ? [] : ['Неверный формат email']
    };
  }

  /**
   * Валидация телефона
   */
  static validatePhone(phone: string): ValidationResult {
    const digitsOnly = phone.replace(/\D/g, '');
    const isValid = digitsOnly.length >= 11;
    
    return {
      isValid,
      errors: isValid ? [] : ['Телефон должен содержать минимум 11 цифр']
    };
  }

  /**
   * Валидация обязательного поля
   */
  static validateRequired(value: string): ValidationResult {
    const isValid = value && value.trim().length > 0;
    
    return {
      isValid,
      errors: isValid ? [] : ['Поле обязательно для заполнения']
    };
  }

  /**
   * Валидация минимальной длины
   */
  static validateMinLength(value: string, minLength: number): ValidationResult {
    const isValid = value && value.trim().length >= minLength;
    
    return {
      isValid,
      errors: isValid ? [] : [`Минимальная длина: ${minLength} символов`]
    };
  }

  /**
   * Валидация способа оплаты
   */
  static validatePayment(payment: string): ValidationResult {
    const isValid = ['card', 'cash'].includes(payment);
    
    return {
      isValid,
      errors: isValid ? [] : ['Выберите способ оплаты']
    };
  }

  /**
   * Валидация адреса
   */
  static validateAddress(address: string): ValidationResult {
    const requiredResult = this.validateRequired(address);
    if (!requiredResult.isValid) {
      return requiredResult;
    }

    const lengthResult = this.validateMinLength(address, 5);
    if (!lengthResult.isValid) {
      return lengthResult;
    }

    return {
      isValid: true,
      errors: []
    };
  }

  /**
   * Валидация контактов
   */
  static validateContacts(email: string, phone: string): ValidationResult {
    const emailResult = this.validateEmail(email);
    const phoneResult = this.validatePhone(phone);

    const allErrors = [...emailResult.errors, ...phoneResult.errors];
    const isValid = emailResult.isValid && phoneResult.isValid;

    return {
      isValid,
      errors: allErrors
    };
  }
} 