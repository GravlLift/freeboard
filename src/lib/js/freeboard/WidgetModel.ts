import ko from 'knockout';
import _ from 'underscore';
import head from 'headjs';
import { FreeboardModel } from './FreeboardModel';
import {
  FreeboardPlugin,
  FreeboardPluginDefinition,
  Settings,
  SettingsType,
} from './Plugin';

export class WidgetModel {
  public datasourceRefreshNotifications: { [key: string]: string[] } = {};
  public calculatedSettingScripts: { [key: string]: Function } = {};

  public title = ko.observable<string>();
  public fillSize = ko.observable(false);

  public type = ko.observable<SettingsType>();

  public settings = ko.observable<Settings>();
  public height = ko.computed({
    read: () => {
      this._heightUpdate();

      if (
        !_.isUndefined(this.widgetInstance) &&
        _.isFunction(this.widgetInstance.getHeight)
      ) {
        return this.widgetInstance.getHeight();
      }

      return 1;
    },
  });

  public shouldRender = ko.observable(false);
  public widgetInstance: FreeboardPlugin | undefined;

  private _heightUpdate = ko.observable();

  constructor(
    private theFreeboardModel: FreeboardModel,
    private widgetPlugins: { [key in SettingsType]: FreeboardPluginDefinition }
  ) {
    const disposeWidgetInstance = () => {
      if (!_.isUndefined(this.widgetInstance)) {
        if (_.isFunction(this.widgetInstance.onDispose)) {
          this.widgetInstance.onDispose();
        }

        this.widgetInstance = undefined;
      }
    };

    this.type.subscribe((newValue) => {
      disposeWidgetInstance();

      if (
        newValue in widgetPlugins &&
        _.isFunction(widgetPlugins[newValue].newInstance)
      ) {
        var widgetType = widgetPlugins[newValue];

        const finishLoad = () => {
          widgetType.newInstance(this.settings(), (widgetInstance) => {
            this.fillSize(widgetType.fill_size === true);
            this.widgetInstance = widgetInstance;
            this.shouldRender(true);
            this._heightUpdate.valueHasMutated();
          });
        };

        // Do we need to load any external scripts?
        if (widgetType.external_scripts) {
          head.js(widgetType.external_scripts.slice(0), finishLoad); // Need to clone the array because head.js adds some weird functions to it
        } else {
          finishLoad();
        }
      }
    });
    this.settings.subscribe((newValue) => {
      if (
        !_.isUndefined(this.widgetInstance) &&
        _.isFunction(this.widgetInstance.onSettingsChanged)
      ) {
        this.widgetInstance.onSettingsChanged(newValue);
      }

      this.updateCalculatedSettings();
      this._heightUpdate.valueHasMutated();
    });
  }

  public processDatasourceUpdate(datasourceName: string) {
    var refreshSettingNames =
      this.datasourceRefreshNotifications[datasourceName];

    if (_.isArray(refreshSettingNames)) {
      _.each(refreshSettingNames, (settingName) => {
        this.processCalculatedSetting(settingName);
      });
    }
  }

  public callValueFunction(theFunction: Function) {
    return theFunction.call(undefined, this.theFreeboardModel.datasourceData);
  }

  public processSizeChange() {
    if (
      !_.isUndefined(this.widgetInstance) &&
      _.isFunction(this.widgetInstance.onSizeChanged)
    ) {
      this.widgetInstance.onSizeChanged();
    }
  }

  public processCalculatedSetting(settingName: string) {
    if (_.isFunction(this.calculatedSettingScripts[settingName])) {
      var returnValue = undefined;

      try {
        returnValue = this.callValueFunction(
          this.calculatedSettingScripts[settingName]
        );
      } catch (e) {
        var rawValue = this.settings()[settingName];

        // If there is a reference error and the value just contains letters and numbers, then
        if (e instanceof ReferenceError && /^\w+$/.test(rawValue)) {
          returnValue = rawValue;
        }
      }

      if (
        !_.isUndefined(this.widgetInstance) &&
        _.isFunction(this.widgetInstance.onCalculatedValueChanged) &&
        !_.isUndefined(returnValue)
      ) {
        try {
          this.widgetInstance.onCalculatedValueChanged(
            settingName,
            returnValue
          );
        } catch (e) {
          console.log(e.toString());
        }
      }
    }
  }
  public updateCalculatedSettings() {
    this.datasourceRefreshNotifications = {};
    this.calculatedSettingScripts = {};

    if (_.isUndefined(this.type())) {
      return;
    }

    // Check for any calculated settings
    var settingsDefs = this.widgetPlugins[this.type()].settings;
    var datasourceRegex = new RegExp(
      'datasources.([\\w_-]+)|datasources\\[[\'"]([^\'"]+)',
      'g'
    );
    var currentSettings = this.settings();

    _.each(settingsDefs, (settingDef) => {
      if (settingDef.type == 'calculated') {
        var script = currentSettings[settingDef.name];

        if (!_.isUndefined(script)) {
          if (_.isArray(script)) {
            script = '[' + script.join(',') + ']';
          }

          // If there is no return, add one
          if (
            (script.match(/;/g) || []).length <= 1 &&
            script.indexOf('return') == -1
          ) {
            script = 'return ' + script;
          }

          var valueFunction;

          try {
            valueFunction = new Function('datasources', script);
          } catch (e) {
            var literalText = currentSettings[settingDef.name]
              .replace(/"/g, '\\"')
              .replace(/[\r\n]/g, ' \\\n');

            // If the value function cannot be created, then go ahead and treat it as literal text
            valueFunction = new Function(
              'datasources',
              'return "' + literalText + '";'
            );
          }

          this.calculatedSettingScripts[settingDef.name] = valueFunction;
          this.processCalculatedSetting(settingDef.name);

          // Are there any datasources we need to be subscribed to?
          var matches;

          while ((matches = datasourceRegex.exec(script))) {
            var dsName = matches[1] || matches[2];
            var refreshSettingNames =
              this.datasourceRefreshNotifications[dsName];

            if (_.isUndefined(refreshSettingNames)) {
              refreshSettingNames = [];
              this.datasourceRefreshNotifications[dsName] = refreshSettingNames;
            }

            if (_.indexOf(refreshSettingNames, settingDef.name) == -1) {
              // Only subscribe to this notification once.
              refreshSettingNames.push(settingDef.name);
            }
          }
        }
      }
    });
  }

  public render(element: HTMLDivElement) {
    this.shouldRender(false);
    if (
      !_.isUndefined(this.widgetInstance) &&
      _.isFunction(this.widgetInstance.render)
    ) {
      this.widgetInstance.render(element);
      this.updateCalculatedSettings();
    }
  }

  public dispose() {}

  public serialize() {
    return {
      title: this.title(),
      type: this.type(),
      settings: this.settings(),
    };
  }

  public deserialize(object: {
    type: SettingsType;
    title: string;
    settings: Settings;
  }) {
    this.title(object.title);
    this.settings(object.settings);
    this.type(object.type);
  }
}
