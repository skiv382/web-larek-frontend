import { Command } from '../Command';
import { appStore } from '../../state/Store';
import { eventBus } from '../../events/EventBus';
import { SimpleValidationEngine } from '../../validators/SimpleValidationEngine';

export interface UpdateOrderFieldCommandData {
  field: 'payment' | 'address' | 'email' | 'phone';
  value: string;
}

export class UpdateOrderFieldCommand extends Command<UpdateOrderFieldCommandData> {
  private oldValue = '';

  async execute(): Promise<void> {
    const { field, value } = this.data;
    
    this.oldValue = appStore.getState().order[field];
    
    appStore.updateOrder(order => ({
      ...order,
      [field]: value,
      validation: {
        ...order.validation,
        [field]: ''
      }
    }));

    let validationError = '';
    
    if (field === 'email') {
      const result = SimpleValidationEngine.validateEmail(value);
      if (!result.isValid) {
        validationError = result.errors.join('; ');
      }
    } else if (field === 'phone') {
      const result = SimpleValidationEngine.validatePhone(value);
      if (!result.isValid) {
        validationError = result.errors.join('; ');
      }
    } else if (field === 'address') {
      const result = SimpleValidationEngine.validateAddress(value);
      if (!result.isValid) {
        validationError = result.errors.join('; ');
      }
    } else if (field === 'payment') {
      const result = SimpleValidationEngine.validatePayment(value);
      if (!result.isValid) {
        validationError = result.errors.join('; ');
      }
    }
    
    if (validationError) {
      appStore.updateOrder(order => ({
        ...order,
        validation: {
          ...order.validation,
          [field]: validationError
        }
      }));
    }

    await eventBus.emit('order:field:updated', { field, value }, 'UpdateOrderFieldCommand');
    
    this.executed = true;
  }

  async undo(): Promise<void> {
    const { field } = this.data;
    
    appStore.updateOrder(order => ({
      ...order,
      [field]: this.oldValue,
      validation: {
        ...order.validation,
        [field]: ''
      }
    }));

    await eventBus.emit('order:field:updated', { 
      field, 
      value: this.oldValue 
    }, 'UpdateOrderFieldCommand');

    this.executed = false;
  }

  canExecute(): boolean {
    return !this.executed && !!this.data.field && this.data.value !== undefined;
  }

  getDescription(): string {
    return `Обновить поле заказа: ${this.data.field}`;
  }
}
