/**
 * Базовый класс для всех команд в системе
 * Реализует паттерн Command с поддержкой отмены и повтора
 */
export abstract class Command<T = unknown> {
  protected executed = false;
  protected data: T;

  constructor(data: T) {
    this.data = data;
  }

  /**
   * Выполнить команду
   */
  abstract execute(): Promise<void>;

  /**
   * Отменить команду
   */
  abstract undo(): Promise<void>;

  /**
   * Повторить команду
   */
  async redo(): Promise<void> {
    if (this.executed) {
      await this.undo();
    }
    await this.execute();
  }

  /**
   * Проверить, можно ли выполнить команду
   */
  abstract canExecute(): boolean;

  /**
   * Получить описание команды для логирования
   */
  abstract getDescription(): string;

  /**
   * Получить данные команды
   */
  getData(): T {
    return this.data;
  }

  /**
   * Проверить, была ли команда выполнена
   */
  isExecuted(): boolean {
    return this.executed;
  }
}

/**
 * Менеджер команд для выполнения, отмены и повтора
 */
export class CommandManager {
  private commands: Command[] = [];
  private currentIndex = -1;
  private maxCommands = 100;

  /**
   * Выполнить команду
   */
  async executeCommand(command: Command): Promise<void> {
    if (!command.canExecute()) {
      throw new Error(`Команда не может быть выполнена: ${command.getDescription()}`);
    }

    // Удаляем команды после текущего индекса (если отменяли)
    this.commands = this.commands.slice(0, this.currentIndex + 1);
    
    // Добавляем новую команду
    this.commands.push(command);
    
    // Ограничиваем количество команд
    if (this.commands.length > this.maxCommands) {
      this.commands.shift();
    } else {
      this.currentIndex++;
    }

    // Выполняем команду
    await command.execute();
  }

  /**
   * Отменить последнюю команду
   */
  async undo(): Promise<void> {
    if (this.currentIndex >= 0) {
      const command = this.commands[this.currentIndex];
      await command.undo();
      this.currentIndex--;
    }
  }

  /**
   * Повторить отмененную команду
   */
  async redo(): Promise<void> {
    if (this.currentIndex < this.commands.length - 1) {
      this.currentIndex++;
      const command = this.commands[this.currentIndex];
      await command.execute();
    }
  }

  /**
   * Проверить, можно ли отменить команду
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Проверить, можно ли повторить команду
   */
  canRedo(): boolean {
    return this.currentIndex < this.commands.length - 1;
  }

  /**
   * Получить историю команд
   */
  getHistory(): Command[] {
    return [...this.commands];
  }

  /**
   * Очистить историю команд
   */
  clearHistory(): void {
    this.commands = [];
    this.currentIndex = -1;
  }
} 