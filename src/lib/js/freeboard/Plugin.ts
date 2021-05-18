export interface FreeboardPluginDefinition {
  type_name: SettingsType;
  settings: Settings | Settings[];
  display_name?: string;
  description?: string;
  external_scripts?: string[];
  fill_size?: boolean;
  typeahead_source?: string;
  typeahead_data_segment: string | number | symbol;
  newInstance: (
    settings: Settings,
    newInstanceCallback: (newInstance: FreeboardPlugin) => void,
    updateCallback?: (data: any) => void
  ) => void;
}

export type SettingsType =
  | 'text'
  | 'number'
  | 'integer'
  | 'calculated'
  | 'boolean'
  | 'option'
  | 'array';

interface BaseSettings {
  name: string;
  display_name?: string;
  type: SettingsType;
  description?: string;
  required?: boolean;
  [key: string]: any;
}

export interface TextSettings extends BaseSettings {
  type: 'text';
  default_value?: string;
}

export interface NumberSettings extends BaseSettings {
  type: 'number';
  default_value?: number;
}

export interface IntegerSettings extends BaseSettings {
  type: 'integer';
  default_value?: number;
}

export interface CalculatedSettings extends BaseSettings {
  type: 'calculated';
  default_value?: any;
  multi_input: string;
}

export interface BooleanSettings extends BaseSettings {
  type: 'boolean';
  default_value?: boolean;
}

export interface OptionSettings extends BaseSettings {
  type: 'option';
  options: { name: string; value: string }[];
}

export interface ArraySettings extends BaseSettings {
  type: 'array';
  settings?: Settings | Settings[];
}

export type Settings =
  | TextSettings
  | NumberSettings
  | IntegerSettings
  | CalculatedSettings
  | BooleanSettings
  | OptionSettings
  | ArraySettings;

export abstract class FreeboardPlugin {
  constructor(
    public settings: Settings[],
    public updateCallback?: () => void
  ) {}
  abstract render(containerElement: HTMLDivElement): void;
  abstract onSettingsChanged(newSettings: Settings): void;
  abstract updateNow(): void;
  abstract onDispose(): void;
  abstract getHeight: () => number;
  abstract onCalculatedValueChanged?: (
    settingName: string,
    newValue: any
  ) => void;
  onSizeChanged?: () => void;
}
