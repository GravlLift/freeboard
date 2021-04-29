export interface FreeboardPluginDefinition {
  type_name: string;
  display_name: string;
  description: string;
  external_scripts: string[];
  settings: Settings[];
  fill_size: boolean;
  newInstance: (
    settings: Settings[],
    newInstanceCallback: (newInstance: FreeboardPlugin) => void,
    updateCallback?: () => void
  ) => void;
}

export interface Settings {
  name: string;
  display_name: string;
  type: 'text' | 'number' | 'calculated' | 'boolean' | 'option' | 'array';
  default_value?: string;
  description?: string;
  required?: boolean;
  options?: { name: string; value: string }[];
  settings?: Settings[];
}

export abstract class FreeboardPlugin {
  constructor(
    public settings: Settings[],
    public updateCallback?: () => void
  ) {}
  abstract onSettingsChanged(newSettings: Settings[]): void;
  abstract updateNow(): void;
  abstract onDispose(): void;
}
