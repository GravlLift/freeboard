import ko from 'knockout';
import _ from 'underscore';
import { FreeboardModel } from './FreeboardModel';
import { FreeboardPluginDefinition, Settings, SettingsType } from './Plugin';
import { WidgetModel } from './WidgetModel';

export class PaneModel {
  private widgets = ko.observableArray<WidgetModel>();

  private title = ko.observable<string>();
  private width = ko.observable(1);
  private row = {};
  private col = {};

  private col_width = ko.observable(1);
  constructor(
    private theFreeboardModel: FreeboardModel,
    private widgetPlugins: { [key in SettingsType]: FreeboardPluginDefinition }
  ) {
    this.col_width.subscribe((newValue) => {
      this.processSizeChange();
    });
  }

  public addWidget(widget: WidgetModel) {
    this.widgets.push(widget);
  }

  public widgetCanMoveUp(widget: WidgetModel) {
    return this.widgets.indexOf(widget) >= 1;
  }

  public widgetCanMoveDown(widget: WidgetModel) {
    var i = this.widgets.indexOf(widget);

    return i < this.widgets().length - 1;
  }

  public moveWidgetUp(widget: WidgetModel) {
    if (this.widgetCanMoveUp(widget)) {
      var i = this.widgets.indexOf(widget);
      var array = this.widgets();
      this.widgets.splice(i - 1, 2, array[i], array[i - 1]);
    }
  }

  public moveWidgetDown(widget: WidgetModel) {
    if (this.widgetCanMoveDown(widget)) {
      var i = this.widgets.indexOf(widget);
      var array = this.widgets();
      this.widgets.splice(i, 2, array[i + 1], array[i]);
    }
  }

  public processSizeChange() {
    // Give the animation a moment to complete. Really hacky.
    // TODO: Make less hacky. Also, doesn't work when screen resizes.
    setTimeout(() => {
      _.each(this.widgets(), (widget) => {
        widget.processSizeChange();
      });
    }, 1000);
  }

  public getCalculatedHeight() {
    var sumHeights = _.reduce(
      this.widgets(),
      (memo, widget) => {
        return memo + widget.height();
      },
      0
    );

    sumHeights *= 6;
    sumHeights += 3;

    sumHeights *= 10;

    var rows = Math.ceil((sumHeights + 20) / 30);

    return Math.max(4, rows);
  }

  public serialize() {
    var widgets: { type: string; title: string; settings: Settings }[] = [];

    _.each(this.widgets(), (widget) => {
      widgets.push(widget.serialize());
    });

    return {
      title: this.title(),
      width: this.width(),
      row: this.row,
      col: this.col,
      col_width: Number(this.col_width()),
      widgets: widgets,
    };
  }

  public deserialize(object: {
    title: string;
    row: {};
    col: {};
    col_width: number;
    widgets: { type: SettingsType; title: string; settings: Settings }[];
    width: number;
  }) {
    this.title(object.title);
    this.width(object.width);

    this.row = object.row;
    this.col = object.col;
    this.col_width(object.col_width || 1);

    _.each(object.widgets, (widgetConfig) => {
      var widget = new WidgetModel(this.theFreeboardModel, this.widgetPlugins);
      widget.deserialize(widgetConfig);
      this.widgets.push(widget);
    });
  }

  public dispose() {
    _.each(this.widgets(), (widget) => {
      widget.dispose();
    });
  }
}
