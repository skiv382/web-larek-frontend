import { Component } from '../base/Component';
import { ensureElement } from '../../utils/utils';
import { ISuccess, ISuccessActions } from '../../types';

export class Success extends Component<ISuccess> {
	protected _close: HTMLButtonElement;
	protected _title: HTMLElement;
	protected _description: HTMLElement;

	constructor(container: HTMLElement, actions: ISuccessActions) {
		super(container);
		this._title = ensureElement<HTMLElement>(
			'.order-success__title',
			this.container
		),
		this._close = ensureElement<HTMLButtonElement>(
			'.order-success__close',
			this.container
		),
		this._description = ensureElement<HTMLElement>(
			'.order-success__description',
			this.container
		);
		if (actions?.onClick) {
			this._close.addEventListener('click', actions.onClick);
		}
	}
	set total(value: number) {
		this.setText(this._description, `Списано ${value} синапсов`);
	}
	render(data: ISuccess): HTMLElement {
		this.setText(this._title, 'Заказ оформлен');
		this.setText(this._description, data.description);
		return this.container;
	}
}