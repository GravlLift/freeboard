import ko from 'knockout';
import _ from 'underscore';
import 'dsmorse-gridster';

export class FreeboardUI {
  private grid: any;

  private PANE_MARGIN = 10;
  private PANE_WIDTH = 300;
  private MIN_COLUMNS = 3;
  private COLUMN_WIDTH = this.PANE_MARGIN + this.PANE_WIDTH + this.PANE_MARGIN;

  private userColumns = this.MIN_COLUMNS;

  private loadingIndicator = $(
    '<div class="wrapperloading"><div class="loading up" ></div><div class="loading down"></div></div>'
  );
  constructor() {
    ko.bindingHandlers.grid = {
      init: (
        element,
        valueAccessor,
        allBindingsAccessor,
        viewModel,
        bindingContext
      ) => {
        // Initialize our grid
        this.grid = $(element)
          .gridster({
            widget_margins: [this.PANE_MARGIN, this.PANE_MARGIN],
            widget_base_dimensions: [this.PANE_WIDTH, 10],
            resize: {
              enabled: false,
              axes: ['x'],
            },
          })
          .data('gridster');

        this.processResize(false);

        this.grid?.disable();
      },
    };
  }

  public disableGrid() {
    this.grid.disable();
  }
  public enableGrid() {
    this.grid.enable();
  }
  public removePane(element: HTMLElement) {
    this.grid.remove_widget(element);
  }
  public removeAllPanes() {
    (this.grid as any).remove_all_widgets();
  }

  public processResize(layoutWidgets) {
    var maxDisplayableColumns = this.getMaxDisplayableColumnCount();
    let repositionFunction: (index?: number) => void = () => {};
    if (layoutWidgets) {
      repositionFunction = (index) => {
        var paneElement = this;
        var paneModel = ko.dataFor(paneElement);

        var newPosition = this.getPositionForScreenSize(paneModel);
        $(paneElement)
          .attr(
            'data-sizex',
            Math.min(
              paneModel.col_width(),
              maxDisplayableColumns,
              this.grid.cols
            )
          )
          .attr('data-row', newPosition.row)
          .attr('data-col', newPosition.col);

        paneModel.processSizeChange();
      };
    }

    this.updateGridWidth(Math.min(maxDisplayableColumns, this.userColumns));

    this.repositionGrid(repositionFunction);
    this.updateGridColumnControls();
  }

  public addGridColumn(shift) {
    var num_cols = this.grid.cols + 1;
    if (this.updateGridWidth(num_cols)) {
      this.repositionGrid(() => {
        var paneElement = this;
        var paneModel = ko.dataFor(paneElement);

        var prevColumnIndex = this.grid.cols > 1 ? this.grid.cols - 1 : 1;
        var prevCol = paneModel.col[prevColumnIndex];
        var prevRow = paneModel.row[prevColumnIndex];
        var newPosition;
        if (shift) {
          leftPreviewCol = true;
          var newCol = prevCol < this.grid.cols ? prevCol + 1 : this.grid.cols;
          newPosition = { row: prevRow, col: newCol };
        } else {
          rightPreviewCol = true;
          newPosition = { row: prevRow, col: prevCol };
        }
        $(paneElement)
          .attr('data-sizex', Math.min(paneModel.col_width(), this.grid.cols))
          .attr('data-row', newPosition.row)
          .attr('data-col', newPosition.col);
      });
    }
    this.updateGridColumnControls();
    this.userColumns = this.grid.cols;
  }

  public subtractGridColumn(shift) {
    var num_cols = this.grid.cols - 1;
    if (this.updateGridWidth(num_cols)) {
      this.repositionGrid(() => {
        var paneElement = this;
        var paneModel = ko.dataFor(paneElement);

        var prevColumnIndex = this.grid.cols + 1;
        var prevCol = paneModel.col[prevColumnIndex];
        var prevRow = paneModel.row[prevColumnIndex];
        var newPosition;
        if (shift) {
          var newCol = prevCol > 1 ? prevCol - 1 : 1;
          newPosition = { row: prevRow, col: newCol };
        } else {
          var newCol = prevCol <= this.grid.cols ? prevCol : this.grid.cols;
          newPosition = { row: prevRow, col: newCol };
        }
        $(paneElement)
          .attr('data-sizex', Math.min(paneModel.col_width(), this.grid.cols))
          .attr('data-row', newPosition.row)
          .attr('data-col', newPosition.col);
      });
    }
    this.updateGridColumnControls();
    this.userColumns = this.grid.cols;
  }

  public updateGridColumnControls() {
    var col_controls = $('.column-tool');
    var available_width = $('#board-content').width();
    var max_columns = Math.floor(available_width / this.COLUMN_WIDTH);

    if (this.grid.cols <= this.MIN_COLUMNS) {
      col_controls.addClass('min');
    } else {
      col_controls.removeClass('min');
    }

    if (this.grid.cols >= max_columns) {
      col_controls.addClass('max');
    } else {
      col_controls.removeClass('max');
    }
  }

  public getMaxDisplayableColumnCount() {
    var available_width = $('#board-content').width();
    return Math.floor(available_width / this.COLUMN_WIDTH);
  }

  public updateGridWidth(newCols) {
    if (newCols === undefined || newCols < this.MIN_COLUMNS) {
      newCols = this.MIN_COLUMNS;
    }

    var max_columns = this.getMaxDisplayableColumnCount();
    if (newCols > max_columns) {
      newCols = max_columns;
    }

    // +newCols to account for scaling on zoomed browsers
    var new_width = this.COLUMN_WIDTH * newCols + newCols;
    $('.responsive-column-width').css('max-width', new_width);

    if (newCols === this.grid.cols) {
      return false;
    } else {
      return true;
    }
  }

  public repositionGrid(repositionFunction) {
    var rootElement = this.grid.$el;

    rootElement.find('> li').unbind().removeData();
    $('.responsive-column-width').css('width', '');
    this.grid.generate_grid_and_stylesheet();

    rootElement.find('> li').each(repositionFunction);

    this.grid.init();
    $('.responsive-column-width').css(
      'width',
      this.grid.cols * this.PANE_WIDTH + this.grid.cols * this.PANE_MARGIN * 2
    );
  }

  public getUserColumns() {
    return this.userColumns;
  }

  public setUserColumns(numCols: number) {
    this.userColumns = Math.max(this.MIN_COLUMNS, numCols);
  }

  public addPane(element, viewModel, isEditing) {
    var position = this.getPositionForScreenSize(viewModel);
    var col = position.col;
    var row = position.row;
    var width = Number(viewModel.width());
    var height = Number(viewModel.getCalculatedHeight());

    this.grid.add_widget(element, width, height, col, row);

    if (isEditing) {
      this.showPaneEditIcons(true);
    }

    this.updatePositionForScreenSize(viewModel, row, col);

    $(element).attrchange({
      trackValues: true,
      callback: (event) => {
        if (event.attributeName == 'data-row') {
          this.updatePositionForScreenSize(
            viewModel,
            Number(event.newValue),
            undefined
          );
        } else if (event.attributeName == 'data-col') {
          this.updatePositionForScreenSize(
            viewModel,
            undefined,
            Number(event.newValue)
          );
        }
      },
    });
  }

  public updatePane(element, viewModel) {
    // If widget has been added or removed
    var calculatedHeight = viewModel.getCalculatedHeight();

    var elementHeight = Number($(element).attr('data-sizey'));
    var elementWidth = Number($(element).attr('data-sizex'));

    if (
      calculatedHeight != elementHeight ||
      viewModel.col_width() != elementWidth
    ) {
      this.grid.resize_widget(
        $(element),
        viewModel.col_width(),
        calculatedHeight,
        () => {
          this.grid.set_dom_grid_height();
        }
      );
    }
  }

  public updatePositionForScreenSize(paneModel, row, col) {
    var displayCols = this.grid.cols;

    if (!_.isUndefined(row)) paneModel.row[displayCols] = row;
    if (!_.isUndefined(col)) paneModel.col[displayCols] = col;
  }

  public showLoadingIndicator(show) {
    if (show) {
      this.loadingIndicator.fadeOut(0).appendTo('body').fadeIn(500);
    } else {
      this.loadingIndicator.fadeOut(500).remove();
    }
  }

  public showPaneEditIcons(show: boolean, animate?: boolean) {
    if (_.isUndefined(animate)) {
      animate = true;
    }

    var animateLength = animate ? 250 : 0;

    if (show) {
      $('.pane-tools').fadeIn(animateLength); //.css("display", "block").animate({opacity: 1.0}, animateLength);
      $('#column-tools').fadeIn(animateLength);
    } else {
      $('.pane-tools').fadeOut(animateLength); //.animate({opacity: 0.0}, animateLength).css("display", "none");//, function()
      $('#column-tools').fadeOut(animateLength);
    }
  }

  public attachWidgetEditIcons(element: JQuery<HTMLElement>) {
    $(element).on(
      'hover',
      () => {
        this.showWidgetEditIcons(this, true);
      },
      () => {
        this.showWidgetEditIcons(this, false);
      }
    );
  }

  public showWidgetEditIcons(element: JQuery<HTMLElement>, show: boolean) {
    if (show) {
      $(element).find('.sub-section-tools').fadeIn(250);
    } else {
      $(element).find('.sub-section-tools').fadeOut(250);
    }
  }

  public getPositionForScreenSize(paneModel) {
    var cols = this.grid.cols;

    if (_.isNumber(paneModel.row) && _.isNumber(paneModel.col)) {
      // Support for legacy format
      var obj = {};
      obj[cols] = paneModel.row;
      paneModel.row = obj;

      obj = {};
      obj[cols] = paneModel.col;
      paneModel.col = obj;
    }

    var newColumnIndex = 1;
    var columnDiff = 1000;

    for (var columnIndex in paneModel.col) {
      if (columnIndex == cols) {
        // If we already have a position defined for this number of columns, return that position
        return {
          row: paneModel.row[columnIndex],
          col: paneModel.col[columnIndex],
        };
      } else if (paneModel.col[columnIndex] > cols) {
        // If it's greater than our display columns, put it in the last column
        newColumnIndex = cols;
      } // If it's less than, pick whichever one is closest
      else {
        var delta = cols - columnIndex;

        if (delta < columnDiff) {
          newColumnIndex = columnIndex;
          columnDiff = delta;
        }
      }
    }

    if (newColumnIndex in paneModel.col && newColumnIndex in paneModel.row) {
      return {
        row: paneModel.row[newColumnIndex],
        col: paneModel.col[newColumnIndex],
      };
    }

    return { row: 1, col: newColumnIndex };
  }
}
