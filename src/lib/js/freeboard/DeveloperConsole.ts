import _ from 'underscore';
import head from 'headjs';
import { DialogBox } from './DialogBox';
import { FreeboardModel } from './FreeboardModel';

export class DeveloperConsole {
  constructor(private theFreeboardModel: FreeboardModel) {}

  public showDeveloperConsole() {
    var pluginScriptsInputs: JQuery<HTMLInputElement>[] = [];
    var container = $('<div></div>');
    var addScript = $('<div class="table-operation text-button">ADD</div>');
    var table = $('<table class="table table-condensed sub-table"></table>');

    table.append(
      $('<thead style=""><tr><th>Plugin Script URL</th></tr></thead>')
    );

    var tableBody = $('<tbody></tbody>');

    table.append(tableBody);

    container
      .append(
        $(
          '<p>Here you can add references to other scripts to load datasource or widget plugins.</p>'
        )
      )
      .append(table)
      .append(addScript)
      .append(
        '<p>To learn how to build plugins for freeboard, please visit <a target="_blank" href="http://freeboard.github.io/freeboard/docs/plugin_example.html">http://freeboard.github.io/freeboard/docs/plugin_example.html</a></p>'
      );

    function refreshScript(scriptURL: string) {
      $('script[src="' + scriptURL + '"]').remove();
    }

    function addNewScriptRow(scriptURL?: string) {
      var tableRow = $<HTMLTableRowElement>('<tr></tr>');
      var tableOperations = $<HTMLUListElement>(
        '<ul class="board-toolbar"></ul>'
      );
      var scriptInput = $<HTMLInputElement>(
        '<input class="table-row-value" style="width:100%;" type="text">'
      );
      var deleteOperation = $<HTMLLIElement>(
        '<li><i class="icon-trash icon-white"></i></li>'
      ).on('click', (e) => {
        pluginScriptsInputs = _.without(pluginScriptsInputs, scriptInput);
        tableRow.remove();
      });

      pluginScriptsInputs.push(scriptInput);

      if (scriptURL) {
        scriptInput.val(scriptURL);
      }

      tableOperations.append(deleteOperation);
      tableBody.append(
        tableRow
          .append($('<td></td>').append(scriptInput))
          .append($('<td class="table-row-operation">').append(tableOperations))
      );
    }

    _.each(this.theFreeboardModel.plugins(), (pluginSource) => {
      addNewScriptRow(pluginSource);
    });

    addScript.on('click', (e) => {
      addNewScriptRow();
    });

    new DialogBox(container, 'Developer Console', 'OK', null, () => {
      // Unload our previous scripts
      _.each(this.theFreeboardModel.plugins(), (pluginSource) => {
        $('script[src^="' + pluginSource + '"]').remove();
      });

      this.theFreeboardModel.plugins.removeAll();

      _.each(pluginScriptsInputs, (scriptInput) => {
        var scriptURL = scriptInput.val() as string | string[];

        if (scriptURL && scriptURL.length > 0) {
          this.theFreeboardModel.addPluginSource(scriptURL);

          // Load the script with a cache buster
          head.js(scriptURL + '?' + Date.now());
        }
      });
    });
  }
}
