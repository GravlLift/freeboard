import ko from 'knockout';
import _ from 'underscore';
import { DatasourceModel } from './DatasourceModel';
import { FreeboardUI } from './FreeboardUI';

export class FreeboardModel {
  public version = 0;
  public isEditing = ko.observable(false);
  public allow_edit = ko.observable(false);
  public datasources = ko.observableArray();

  public header_image = ko.observable();
  public plugins = ko.observableArray();
  public panes = ko.observableArray();
  public datasourceData = {};

  constructor(
    datasourcePlugins,
    widgetPlugins,
    private freeboardUI: FreeboardUI
  ) {
    var SERIALIZATION_VERSION = 1;

    this.allow_edit.subscribe((newValue) => {
      if (newValue) {
        $('#main-header').show();
      } else {
        $('#main-header').hide();
      }
    });

    this._datasourceTypes = ko.observable();
    this.datasourceTypes = ko.computed({
      read: () => {
        this._datasourceTypes();

        var returnTypes = [];

        _.each(datasourcePlugins, (datasourcePluginType) => {
          var typeName = datasourcePluginType.type_name;
          var displayName = typeName;

          if (!_.isUndefined(datasourcePluginType.display_name)) {
            displayName = datasourcePluginType.display_name;
          }

          returnTypes.push({
            name: typeName,
            display_name: displayName,
          });
        });

        return returnTypes;
      },
    });

    this._widgetTypes = ko.observable();
    this.widgetTypes = ko.computed({
      read: () => {
        this._widgetTypes();

        var returnTypes = [];

        _.each(widgetPlugins, (widgetPluginType) => {
          var typeName = widgetPluginType.type_name;
          var displayName = typeName;

          if (!_.isUndefined(widgetPluginType.display_name)) {
            displayName = widgetPluginType.display_name;
          }

          returnTypes.push({
            name: typeName,
            display_name: displayName,
          });
        });

        return returnTypes;
      },
    });
  }

  public addPluginSource(pluginSource) {
    if (pluginSource && this.plugins.indexOf(pluginSource) == -1) {
      this.plugins.push(pluginSource);
    }
  }

  public serialize() {
    var panes = [];

    _.each(this.panes(), (pane) => {
      panes.push(pane.serialize());
    });

    var datasources = [];

    _.each(this.datasources(), (datasource) => {
      datasources.push(datasource.serialize());
    });

    return {
      version: SERIALIZATION_VERSION,
      header_image: this.header_image(),
      allow_edit: this.allow_edit(),
      plugins: this.plugins(),
      panes: panes,
      datasources: datasources,
      columns: freeboardUI.getUserColumns(),
    };
  }

  public deserialize(object, finishedCallback) {
    this.clearDashboard();

    function finishLoad() {
      freeboardUI.setUserColumns(object.columns);

      if (!_.isUndefined(object.allow_edit)) {
        this.allow_edit(object.allow_edit);
      } else {
        this.allow_edit(true);
      }
      this.version = object.version || 0;
      this.header_image(object.header_image);

      _.each(object.datasources, (datasourceConfig) => {
        var datasource = new DatasourceModel(this, datasourcePlugins);
        datasource.deserialize(datasourceConfig);
        this.addDatasource(datasource);
      });

      var sortedPanes = _.sortBy(object.panes, (pane) => {
        return freeboardUI.getPositionForScreenSize(pane).row;
      });

      _.each(sortedPanes, (paneConfig) => {
        var pane = new PaneModel(this, widgetPlugins);
        pane.deserialize(paneConfig);
        this.panes.push(pane);
      });

      if (this.allow_edit() && this.panes().length == 0) {
        this.setEditing(true);
      }

      if (_.isFunction(finishedCallback)) {
        finishedCallback();
      }

      freeboardUI.processResize(true);
    }

    // This could have been this.plugins(object.plugins), but for some weird reason head.js was causing a function to be added to the list of plugins.
    _.each(object.plugins, (plugin) => {
      this.addPluginSource(plugin);
    });

    // Load any plugins referenced in this definition
    if (_.isArray(object.plugins) && object.plugins.length > 0) {
      head.js(object.plugins, () => {
        finishLoad();
      });
    } else {
      finishLoad();
    }
  }

  public processDatasourceUpdate(datasourceModel: DatasourceModel, newData) {
    var datasourceName = datasourceModel.name();

    this.datasourceData[datasourceName] = newData;

    _.each(this.panes(), (pane) => {
      _.each(pane.widgets(), (widget) => {
        widget.processDatasourceUpdate(datasourceName);
      });
    });
  }

  public clearDashboard() {
    this.freeboardUI.removeAllPanes();

    _.each(this.datasources(), (datasource) => {
      datasource.dispose();
    });

    _.each(this.panes(), (pane) => {
      pane.dispose();
    });

    this.plugins.removeAll();
    this.datasources.removeAll();
    this.panes.removeAll();
  }

  public loadDashboard(dashboardData, callback) {
    freeboardUI.showLoadingIndicator(true);
    this.deserialize(dashboardData, () => {
      freeboardUI.showLoadingIndicator(false);

      if (_.isFunction(callback)) {
        callback();
      }

      freeboard.emit('dashboard_loaded');
    });
  }

  public loadDashboardFromLocalFile() {
    // Check for the various File API support.
    if (window.File && window.FileReader && window.FileList && window.Blob) {
      var input = document.createElement('input');
      input.type = 'file';
      $(input).on('change', (event) => {
        var files = event.target.files;

        if (files && files.length > 0) {
          var file = files[0];
          var reader = new FileReader();

          reader.addEventListener('load', (fileReaderEvent) => {
            var textFile = fileReaderEvent.target;
            var jsonObject = JSON.parse(textFile.result);

            this.loadDashboard(jsonObject);
            this.setEditing(false);
          });

          reader.readAsText(file);
        }
      });
      $(input).trigger('click');
    } else {
      alert('Unable to load a file in this browser.');
    }
  }

  public saveDashboardClicked() {
    var target = $(event.currentTarget);
    var siblingsShown = target.data('siblings-shown') || false;
    if (!siblingsShown) {
      $(event.currentTarget).siblings('label').fadeIn('slow');
    } else {
      $(event.currentTarget).siblings('label').fadeOut('slow');
    }
    target.data('siblings-shown', !siblingsShown);
  }

  public saveDashboard(_thisref, event) {
    var pretty = $(event.currentTarget).data('pretty');
    var contentType = 'application/octet-stream';
    var a = document.createElement('a');
    if (pretty) {
      var blob = new Blob([JSON.stringify(this.serialize(), null, '\t')], {
        type: contentType,
      });
    } else {
      var blob = new Blob([JSON.stringify(this.serialize())], {
        type: contentType,
      });
    }
    document.body.appendChild(a);
    a.href = window.URL.createObjectURL(blob);
    a.download = 'dashboard.json';
    a.target = '_self';
    a.on('click');
  }

  public addDatasource(datasource) {
    this.datasources.push(datasource);
  }

  public deleteDatasource(datasource) {
    delete this.datasourceData[datasource.name()];
    datasource.dispose();
    this.datasources.remove(datasource);
  }

  public createPane() {
    var newPane = new PaneModel(this, widgetPlugins);
    this.addPane(newPane);
  }

  public addGridColumnLeft() {
    freeboardUI.addGridColumnLeft();
  }

  public addGridColumnRight() {
    freeboardUI.addGridColumnRight();
  }

  public subGridColumnLeft() {
    freeboardUI.subGridColumnLeft();
  }

  public subGridColumnRight() {
    freeboardUI.subGridColumnRight();
  }

  public addPane(pane) {
    this.panes.push(pane);
  }

  public deletePane(pane) {
    pane.dispose();
    this.panes.remove(pane);
  }

  public deleteWidget(widget) {
    ko.utils.arrayForEach(this.panes(), (pane) => {
      pane.widgets.remove(widget);
    });

    widget.dispose();
  }

  public setEditing(editing, animate) {
    // Don't allow editing if it's not allowed
    if (!this.allow_edit() && editing) {
      return;
    }

    this.isEditing(editing);

    if (_.isUndefined(animate)) {
      animate = true;
    }

    var animateLength = animate ? 250 : 0;
    var barHeight = $('#admin-bar').outerHeight();

    if (!editing) {
      $('#toggle-header-icon')
        .addClass('icon-wrench')
        .removeClass('icon-chevron-up');
      $('.gridster .gs_w').css({ cursor: 'default' });
      $('#main-header').animate({ top: '-' + barHeight + 'px' }, animateLength);
      $('#board-content').animate({ top: '20' }, animateLength);
      $('#main-header').data().shown = false;
      $('.sub-section').unbind();
      freeboardUI.disableGrid();
    } else {
      $('#toggle-header-icon')
        .addClass('icon-chevron-up')
        .removeClass('icon-wrench');
      $('.gridster .gs_w').css({ cursor: 'pointer' });
      $('#main-header').animate({ top: '0px' }, animateLength);
      $('#board-content').animate(
        { top: barHeight + 20 + 'px' },
        animateLength
      );
      $('#main-header').data().shown = true;
      freeboardUI.attachWidgetEditIcons($('.sub-section'));
      freeboardUI.enableGrid();
    }

    freeboardUI.showPaneEditIcons(editing, animate);
  }

  public toggleEditing() {
    var editing = !this.isEditing();
    this.setEditing(editing);
  }
}
