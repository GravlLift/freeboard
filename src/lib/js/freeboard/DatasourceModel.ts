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

export class DatasourceModel {
  name: ko.Observable<any> = ko.observable();
  latestData: ko.Observable<any> = ko.observable();
  settings: ko.Observable<Settings> = ko.observable();
  type = ko.observable<SettingsType>();
  datasourceInstance: FreeboardPlugin;
  last_updated = ko.observable('never');
  last_error = ko.observable();

  constructor(
    private theFreeboardModel: FreeboardModel,
    datasourcePlugins: { [key in SettingsType]: FreeboardPluginDefinition }
  ) {
    this.settings.subscribe((newValue) => {
      if (
        newValue &&
        !_.isUndefined(this.datasourceInstance) &&
        _.isFunction(this.datasourceInstance.onSettingsChanged)
      ) {
        this.datasourceInstance.onSettingsChanged(newValue);
      }
    });

    this.type.subscribe((newValue) => {
      this.disposeDatasourceInstance();

      if (
        newValue in datasourcePlugins &&
        _.isFunction(datasourcePlugins[newValue].newInstance)
      ) {
        var datasourceType = datasourcePlugins[newValue];

        const finishLoad = () => {
          datasourceType.newInstance(
            this.settings(),
            (datasourceInstance) => {
              this.datasourceInstance = datasourceInstance;
              datasourceInstance.updateNow();
            },
            this.updateCallback
          );
        };

        // Do we need to load any external scripts?
        if (datasourceType.external_scripts) {
          head.js(datasourceType.external_scripts.slice(0), finishLoad); // Need to clone the array because head.js adds some weird functions to it
        } else {
          finishLoad();
        }
      }
    });
  }

  private disposeDatasourceInstance() {
    if (!_.isUndefined(this.datasourceInstance)) {
      if (_.isFunction(this.datasourceInstance.onDispose)) {
        this.datasourceInstance.onDispose();
      }

      this.datasourceInstance = undefined;
    }
  }

  serialize() {
    return {
      name: this.name(),
      type: this.type(),
      settings: this.settings(),
    };
  }

  deserialize(object: { settings: Settings; name: any; type: SettingsType }) {
    this.settings(object.settings);
    this.name(object.name);
    this.type(object.type);
  }

  getDataRepresentation(dataPath: string) {
    var valueFunction = new Function('data', 'return ' + dataPath + ';');
    return valueFunction.call(undefined, this.latestData());
  }

  updateNow() {
    if (
      !_.isUndefined(this.datasourceInstance) &&
      _.isFunction(this.datasourceInstance.updateNow)
    ) {
      this.datasourceInstance.updateNow();
    }
  }

  updateCallback(newData: any) {
    this.theFreeboardModel.processDatasourceUpdate(this, newData);

    this.latestData(newData);

    var now = new Date();
    this.last_updated(now.toLocaleTimeString());
  }

  dispose() {
    this.disposeDatasourceInstance();
  }
}
