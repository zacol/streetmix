import {
  SETTINGS_UNITS_IMPERIAL,
  SETTINGS_UNITS_METRIC
} from '../users/localization'
import store from '../store'

const IMPERIAL_METRIC_MULTIPLIER = 30 / 100
const METRIC_PRECISION = 3

const WIDTH_INPUT_CONVERSION = [
  { text: 'm', multiplier: 1 / IMPERIAL_METRIC_MULTIPLIER },
  { text: 'cm', multiplier: 1 / 100 / IMPERIAL_METRIC_MULTIPLIER },
  { text: '"', multiplier: 1 / 12 },
  { text: 'inch', multiplier: 1 / 12 },
  { text: 'inches', multiplier: 1 / 12 },
  { text: "'", multiplier: 1 },
  { text: 'ft', multiplier: 1 },
  { text: 'ft.', multiplier: 1 },
  { text: 'feet', multiplier: 1 }
]

const IMPERIAL_VULGAR_FRACTIONS = {
  '.125': '⅛',
  '.25': '¼',
  '.375': '⅜',
  '.5': '½',
  '.625': '⅝',
  '.75': '¾',
  '.875': '⅞'
}

/**
 * Processes width input from user
 *
 * @param {string} widthInput
 * @param {Number} units - either SETTINGS_UNITS_METRIC or SETTINGS_UNITS_IMPERIAL
 * @returns {Number} width - in default units, regardless of provided units
 */
export function processWidthInput (widthInput, units) {
  if (!widthInput || !units) return

  // Normalize certain input quirks. Spaces (more common at end or beginning of input)
  // go away, and comma-based decimals turn into period-based decimals
  widthInput = widthInput.replace(/ /g, '')
  widthInput = widthInput.replace(/,/g, '.')

  for (let i in IMPERIAL_VULGAR_FRACTIONS) {
    if (widthInput.indexOf(IMPERIAL_VULGAR_FRACTIONS[i]) !== -1) {
      widthInput = widthInput.replace(new RegExp(IMPERIAL_VULGAR_FRACTIONS[i]), i)
    }
  }

  let width

  // The conditional makes sure we only split and parse separately when the input includes ' as any character except the last
  if (widthInput.indexOf("'") !== -1 && widthInput.length > widthInput.indexOf("'") + 1) {
    widthInput = widthInput.split("'")
    widthInput[0] += "'" // Add the ' to the first value so the parser knows to convert in feet, not in unitless, when in metric
    width = widthInput.reduce(function (prev, cur) {
      if (cur.indexOf('"') === -1) { // Assuming anything coming after feet is going to be inches
        cur += '"'
      }

      return parseStringForUnits(prev.toString()) + parseStringForUnits(cur.toString(), units)
    })
  } else {
    width = parseStringForUnits(widthInput, units)
  }

  return width
}

/**
 * Formats a width to a "pretty" output and converts the value to the user's
 * current units settings (imperial or metric).
 *
 * @param {Number} width to display
 * @param {Boolean} [options.markup = false]
 * @param {Number} [options.units] - units, either SETTINGS_UNITS_METRIC or
 *            SETTINGS_UNITS_IMPERIAL, to format width as. If undefined,
 *            temporarily run get street data from store to obtain units.
 *            Todo: refactor this so that units is a required argument.
 *    If true, <wbr> (word break opportunity) tags are inserted into return value.
 */
export function prettifyWidth (width, { markup = false, units } = {}) {
  let widthText = ''

  // TODO: temporary; refactor so `units` is required
  if (units === undefined) {
    units = store.getState().street.units
  }

  switch (units) {
    case SETTINGS_UNITS_IMPERIAL:
      widthText = width

      // Format with vulgar fractions, e.g. .5 => ½
      const remainder = width - Math.floor(width)

      if (IMPERIAL_VULGAR_FRACTIONS[('' + remainder).substr(1)]) {
        widthText =
        (Math.floor(width) ? Math.floor(width) : '') +
          IMPERIAL_VULGAR_FRACTIONS[('' + remainder).substr(1)]
      }

      // Add word break opportunity <wbr> tags and foot mark
      if (markup === true) {
        widthText += "<wbr>'"
      } else {
        widthText += "'"
      }

      break
    case SETTINGS_UNITS_METRIC:
    default:
      widthText = undecorateWidth(width)

      // Add word break opportunity <wbr> tags and units, assuming
      // that the output is not used in an input tag
      if (markup === true) {
        widthText += '<wbr> m'
      } else {
        widthText += ' m'
      }

      break
  }

  return widthText
}

/**
 * Returns a width as a numeral-only string without decoration, and converts
 * the value to the user's current units settings (imperial or metric).
 * Used primarily when converting input box values to a simple number format
 *
 * @param {Number} width to display
 * @param {Number} units - either SETTINGS_UNITS_METRIC or SETTINGS_UNITS_IMPERIAL
 */
export function undecorateWidth (width, units) {
  let widthText = ''

  // TODO: temporary; refactor so `units` is required
  if (units === undefined) {
    units = store.getState().street.units
  }

  switch (units) {
    // Width is stored as imperial units by default, so return it as is
    case SETTINGS_UNITS_IMPERIAL:
      widthText = width
      break
    // Otherwise convert it metric
    case SETTINGS_UNITS_METRIC:
    default:
      widthText = convertWidthToMetric(width)
      widthText = stringifyMetricWidth(widthText)
      break
  }

  return widthText
}

/**
 * Given a width (stored internally in Streetmix as imperial units),
 * return a metric quantity with three decimal points.
 *
 * @param {Number} width
 * @returns {Number} width as metric quantity
 */
function convertWidthToMetric (width) {
  return (width * IMPERIAL_METRIC_MULTIPLIER).toFixed(METRIC_PRECISION)
}

/**
 * Given a width in metric units, returns a value that is post-processed
 * for display. Leading and trailing zeroes are clipped, trailing decimals
 * are dropped, and null values return zero.
 *
 * @param {Number} width as metric quantity
 * @returns {String} formatted string
 */
function stringifyMetricWidth (width) {
  let widthText = width.toString()

  if (widthText.substr(0, 2) === '0.') {
    widthText = widthText.substr(1)
  }
  while (widthText.substr(widthText.length - 1) === '0') {
    widthText = widthText.substr(0, widthText.length - 1)
  }
  if (widthText.substr(widthText.length - 1) === '.') {
    widthText = widthText.substr(0, widthText.length - 1)
  }
  if (!widthText) {
    widthText = '0'
  }

  return widthText
}

/**
 * Given a width in any unit (including no unit), parses for units and returns
 * value multiplied by the appropriate multiplier.
 *
 * @param {String} widthInput to convert to number
 * @param {Number} units - either SETTINGS_UNITS_METRIC or SETTINGS_UNITS_IMPERIAL
 * @returns {Number} formatted width as number
 */
function parseStringForUnits (widthInput, units) {
  if (widthInput.indexOf('-') !== -1) {
    widthInput = widthInput.replace(/-/g, '') // Dashes would mean negative in the parseFloat
  }

  let width = Number.parseFloat(widthInput)

  if (width) {
    let multiplier

    if (units === SETTINGS_UNITS_METRIC) {
      // Checks for a unitless input when metric
      multiplier = 1 / IMPERIAL_METRIC_MULTIPLIER
    } else {
      // Default multiplier, is true if units are imperial
      // TODO: metric units should be default
      multiplier = 1
    }

    for (let i in WIDTH_INPUT_CONVERSION) {
      if (widthInput.match(new RegExp('[\\d\\.]' + WIDTH_INPUT_CONVERSION[i].text + '$'))) {
        multiplier = WIDTH_INPUT_CONVERSION[i].multiplier
        break
      }
    }
    width *= multiplier
    return width
  } else {
    return 0 // Allows for leading zeros, like 0'7"
  }
}
