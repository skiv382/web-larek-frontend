import { Command } from '../Command';
import { appStore } from '../../state/Store';
import { eventBus } from '../../events/EventBus';

export interface CloseModalCommandData {
  modalType?: string;
}

export class CloseModalCommand extends Command<CloseModalCommandData> {
  async execute(): Promise<void> {
    appStore.updateUI(ui => ({
      ...ui,
      modal: {
        isOpen: false,
        content: null,
        product: null
      }
    }));

    await eventBus.emit('modal:closed', {}, 'CloseModalCommand');
    
    this.executed = true;
  }

  async undo(): Promise<void> {
    appStore.updateUI(ui => ({
      ...ui,
      modal: {
        isOpen: true,
        content: 'default',
        product: null
      }
    }));

    await eventBus.emit('modal:opened', { content: 'default' }, 'CloseModalCommand');
    
    this.executed = false;
  }

  canExecute(): boolean {
    return !this.executed;
  }

  getDescription(): string {
    return 'Закрыть модальное окно';
  }
}
