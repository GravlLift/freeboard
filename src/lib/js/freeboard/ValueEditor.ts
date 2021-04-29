import _ from 'underscore';
import { FreeboardModel } from './FreeboardModel';

export enum EXPECTED_TYPE {
  ANY = 'any',
  ARRAY = 'array',
  OBJECT = 'object',
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
}

export class ValueEditor {
  private _veDatasourceRegex = new RegExp(
    '.*datasources\\["([^"]*)("\\])?(.*)$'
  );

  private dropdown: JQuery<HTMLUListElement> | null = null;
  private selectedOptionIndex = 0;
  private _autocompleteOptions = [];
  private currentValue = null;

  constructor(private theFreeboardModel: FreeboardModel) {}

  private _isPotentialTypeMatch(value: any, expectsType: EXPECTED_TYPE) {
    if (_.isArray(value) || _.isObject(value)) {
      return true;
    }
    return this._isTypeMatch(value, expectsType);
  }

  private _isTypeMatch(value: any, expectsType: EXPECTED_TYPE) {
    switch (expectsType) {
      case EXPECTED_TYPE.ANY:
        return true;
      case EXPECTED_TYPE.ARRAY:
        return _.isArray(value);
      case EXPECTED_TYPE.OBJECT:
        return _.isObject(value);
      case EXPECTED_TYPE.STRING:
        return _.isString(value);
      case EXPECTED_TYPE.NUMBER:
        return _.isNumber(value);
      case EXPECTED_TYPE.BOOLEAN:
        return _.isBoolean(value);
    }
  }

  private _checkCurrentValueType(element: any, expectsType: EXPECTED_TYPE) {
    $(element).parent().find('.validation-error').remove();
    if (!this._isTypeMatch(this.currentValue, expectsType)) {
      $(element)
        .parent()
        .append(
          "<div class='validation-error'>" +
            'This field expects an expression that evaluates to type ' +
            expectsType +
            '.</div>'
        );
    }
  }

  private _resizeValueEditor(element: any) {
    var lineBreakCount = (($(element).val() as string).match(/\n/g) || [])
      .length;

    var newHeight = Math.min(200, 20 * (lineBreakCount + 1));

    $(element).css({ height: newHeight + 'px' });
  }

  private _autocompleteFromDatasource(
    inputString: string,
    datasources: ko.ObservableArray<any>,
    expectsType: EXPECTED_TYPE
  ) {
    var match = this._veDatasourceRegex.exec(inputString);

    var options = [];

    if (match) {
      // Editor value is: datasources["; List all datasources
      if (match[1] == '') {
        _.each(datasources, (datasource) => {
          options.push({
            value: datasource.name(),
            entity: undefined,
            precede_char: '',
            follow_char: '"]',
          });
        });
      }
      // Editor value is a partial match for a datasource; list matching datasources
      else if (match[1] != '' && _.isUndefined(match[2])) {
        var replacementString = match[1];

        _.each(datasources, (datasource) => {
          var dsName = datasource.name();

          if (
            dsName != replacementString &&
            dsName.indexOf(replacementString) == 0
          ) {
            options.push({
              value: dsName,
              entity: undefined,
              precede_char: '',
              follow_char: '"]',
            });
          }
        });
      }
      // Editor value matches a datasources; parse JSON in order to populate list
      else {
        // We already have a datasource selected; find it
        var datasource = _.find(datasources, function (datasource) {
          return match && datasource.name() === match[1];
        });

        if (!_.isUndefined(datasource)) {
          var dataPath = 'data';
          var remainder = '';

          // Parse the partial JSON selectors
          if (!_.isUndefined(match[2])) {
            // Strip any incomplete field values, and store the remainder
            var remainderIndex = match[3].lastIndexOf(']') + 1;
            dataPath = dataPath + match[3].substring(0, remainderIndex);
            remainder = match[3].substring(remainderIndex, match[3].length);
            remainder = remainder.replace(/^[\[\"]*/, '');
            remainder = remainder.replace(/[\"\]]*$/, '');
          }

          // Get the data for the last complete JSON field
          var dataValue = datasource.getDataRepresentation(dataPath);
          this.currentValue = dataValue;

          // For arrays, list out the indices
          if (_.isArray(dataValue)) {
            for (var index = 0; index < dataValue.length; index++) {
              if (index.toString().indexOf(remainder) == 0) {
                var value = dataValue[index];
                if (this._isPotentialTypeMatch(value, expectsType)) {
                  options.push({
                    value: index,
                    entity: value,
                    precede_char: '[',
                    follow_char: ']',
                    preview: value.toString(),
                  });
                }
              }
            }
          }
          // For objects, list out the keys
          else if (_.isObject(dataValue)) {
            _.each(dataValue, (value, name) => {
              if (name.indexOf(remainder) == 0) {
                if (this._isPotentialTypeMatch(value, expectsType)) {
                  options.push({
                    value: name,
                    entity: value,
                    precede_char: '["',
                    follow_char: '"]',
                  });
                }
              }
            });
          }
          // For everything else, do nothing (no further selection possible)
          else {
            // no-op
          }
        }
      }
    }
    this._autocompleteOptions = options;
  }

  private _renderAutocompleteDropdown(
    element: any,
    expectsType: EXPECTED_TYPE
  ) {
    var inputString = $(element)
      .val()
      ?.toString()
      .substring(0, $(element).getCaretPosition());

    // Weird issue where the textarea box was putting in ASCII (nbsp) for spaces.
    inputString = inputString.replace(String.fromCharCode(160), ' ');

    this._autocompleteFromDatasource(
      inputString,
      this.theFreeboardModel.datasources(),
      expectsType
    );

    if (_autocompleteOptions.length > 0) {
      if (!this.dropdown) {
        this.dropdown = $(
          '<ul id="value-selector" class="value-dropdown"></ul>'
        )
          .insertAfter(element)
          .width(($(element).outerWidth() || 0) - 2)
          .css('left', $(element).position().left)
          .css(
            'top',
            $(element).position().top + ($(element).outerHeight() || 0) - 1
          );
      }

      this.dropdown?.empty();
      this.dropdown?.scrollTop(0);

      var selected = true;
      this.selectedOptionIndex = 0;

      _.each(this._autocompleteOptions, (option, index) => {
        var li = this._renderAutocompleteDropdownOption(
          element,
          inputString,
          option,
          index
        );
        if (selected) {
          $(li).addClass('selected');
          selected = false;
        }
      });
    } else {
      _checkCurrentValueType(element, expectsType);
      $(element).next('ul#value-selector').remove();
      dropdown = null;
      selectedOptionIndex = -1;
    }
  }

  private _renderAutocompleteDropdownOption(
    element,
    inputString,
    option,
    currentIndex
  ) {
    var optionLabel = option.value;
    if (option.preview) {
      optionLabel =
        optionLabel + "<span class='preview'>" + option.preview + '</span>';
    }
    var li = $('<li>' + optionLabel + '</li>')
      .appendTo(dropdown)
      .mouseenter(function () {
        $(this).trigger('freeboard-select');
      })
      .mousedown(function (event) {
        $(this).trigger('freeboard-insertValue');
        event.preventDefault();
      })
      .data('freeboard-optionIndex', currentIndex)
      .data('freeboard-optionValue', option.value)
      .bind('freeboard-insertValue', function () {
        var optionValue = option.value;
        optionValue = option.precede_char + optionValue + option.follow_char;

        var replacementIndex = inputString.lastIndexOf(']');
        if (replacementIndex != -1) {
          $(element).replaceTextAt(
            replacementIndex + 1,
            $(element).val().length,
            optionValue
          );
        } else {
          $(element).insertAtCaret(optionValue);
        }

        this.currentValue = option.entity;
        $(element).triggerHandler('mouseup');
      })
      .bind('freeboard-select', function () {
        $(this).parent().find('li.selected').removeClass('selected');
        $(this).addClass('selected');
        this.selectedOptionIndex = $(this).data('freeboard-optionIndex');
      });
    return li;
  }

  public createValueEditor(element: any, expectsType = EXPECTED_TYPE.ANY) {
    $(element)
      .addClass('calculated-value-input')
      .on('keyup mouseup freeboard-eval', function (event) {
        // Ignore arrow keys and enter keys
        if (
          dropdown &&
          event.type == 'keyup' &&
          (event.keyCode == 38 || event.keyCode == 40 || event.keyCode == 13)
        ) {
          event.preventDefault();
          return;
        }
        this._renderAutocompleteDropdown(element, expectsType);
      })
      .on('focus', function () {
        $(element).css({ 'z-index': 3001 });
        this._resizeValueEditor(element);
      })
      .on('focusout', function () {
        this._checkCurrentValueType(element, expectsType);
        $(element).css({
          height: '',
          'z-index': 3000,
        });
        $(element).next('ul#value-selector').remove();
        this.dropdown = null;
        this.selectedOptionIndex = -1;
      })
      .on('keydown', function (event) {
        if (this.dropdown) {
          if (event.keyCode == 38 || event.keyCode == 40) {
            // Handle Arrow keys
            event.preventDefault();

            var optionItems = $(this.dropdown).find('li');

            if (event.keyCode == 38) {
              // Up Arrow
              this.selectedOptionIndex--;
            } else if (event.keyCode == 40) {
              // Down Arrow
              this.selectedOptionIndex++;
            }

            if (this.selectedOptionIndex < 0) {
              this.selectedOptionIndex = optionItems.size() - 1;
            } else if (this.selectedOptionIndex >= optionItems.size()) {
              this.selectedOptionIndex = 0;
            }

            var optionElement = $(optionItems).eq(this.selectedOptionIndex);

            optionElement.trigger('freeboard-select');
            $(this.dropdown).scrollTop($(optionElement).position().top);
          } else if (event.keyCode == 13) {
            // Handle enter key
            event.preventDefault();

            if (this.selectedOptionIndex != -1) {
              $(this.dropdown)
                .find('li')
                .eq(this.selectedOptionIndex)
                .trigger('freeboard-insertValue');
            }
          }
        }
      });
  }
}
