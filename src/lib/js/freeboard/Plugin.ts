export interface FreeboardPluginDefinition {
  type_name: string;
  display_name?: string;
  description?: string;
  external_scripts?: string[];
  settings: Settings[];
  fill_size?: boolean;
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

export interface Settings {
  name: string;
  display_name?: string;
  type: SettingsType;
  default_value?: string;
  description?: string;
  required?: boolean;
  options?: { name: string; value: string }[];
  settings?: { [key: string]: any } | Settings | Settings[];
  multi_input: string;
  [key: string]: any;
}

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
