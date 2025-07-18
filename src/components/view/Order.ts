import { IOrderForm } from '../../types';
import { ensureElement } from '../../utils/utils';
import { Component } from '../base/Component';
import { EventEmitter } from '../base/events';

export class Order extends Component<IOrderForm> {
	protected _paymentButtons: HTMLButtonElement[];
	protected _addressInput: HTMLInputElement;
	protected _submitButton: HTMLButtonElement;
	protected _errors: HTMLElement;
	protected _selectedPayment: string | null = null;

	constructor(container: HTMLFormElement, protected events: EventEmitter) {
		super(container);
		this._paymentButtons = Array.from(
			container.querySelectorAll('.order__buttons button')
		);
		this._addressInput = ensureElement<HTMLInputElement>(
			'input[name="address"]',
			container
		);
		this._submitButton = ensureElement<HTMLButtonElement>(
			'button[type="submit"]',
			container
		);
		this._errors = ensureElement<HTMLElement>('.form__errors', container);
		this._paymentButtons.forEach((button) => {
			button.addEventListener('click', () => {
				this._selectedPayment = button.name;
				this._updatePaymentUI();
				this.events.emit('order.payment:change', {
					field: 'payment',
					value: this._selectedPayment,
				});
			});
		});
		this._addressInput.addEventListener('input', () => {
			this.events.emit('order.address:change', {
				field: 'address',
				value: this._addressInput.value,
			});
		});
		this.container.addEventListener('submit', (event) => {
			event.preventDefault();
			if (this._selectedPayment && this._addressInput.value) {
				this.events.emit('order:submit', {
					payment: this._selectedPayment,
					address: this._addressInput.value,
				});
			}
		});
	}
	private _updatePaymentUI(): void {
		this._paymentButtons.forEach((button) => {
			button.classList.toggle(
				'button_alt-active',
				button.name === this._selectedPayment
			);
		});
	}
	set valid(value: boolean) {
		this.setDisabled(this._submitButton, !value);
	}
	set errors(value: string) {
		this.setText(this._errors, value);
	}
}