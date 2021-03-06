// This WebWorker provides a safe environment to run user scripts
// See http://stackoverflow.com/questions/10653809/making-webworkers-a-safe-environment/10796616

/* global Handlebars, postMessage, close */

// Classeur own helpers
Handlebars.registerHelper('toYaml', function (object) {
  var yamlSpecialChars = /[:{}[\],&*#?|\-<>=!%@\\]/
  if (typeof object === 'object') {
    var keys = Object.keys(object)
    return new Handlebars.SafeString(keys.reduce(function (result, key) {
      var value = object[key].replace("'", "\\'")
      key = key.replace("'", "\\'")
      if (key.match(yamlSpecialChars)) {
        key = "'" + key + "'"
      }
      if (value.match(yamlSpecialChars)) {
        value = "'" + value + "'"
      }
      return result + key + ': ' + value + '\n'
    }, ''))
  }
})
Handlebars.registerHelper('tocToHtml', function (toc, depth) {
  function arrayToHtml (arr, depth) {
    if (!arr || !arr.length || arr[0].level > depth) {
      return ''
    }
    return '\n<ul>\n' +
      arr.map(function (item) {
        var result = '<li>'
        if (item.anchor && item.title) {
          result += '<a href="#' + item.anchor + '">' + item.title + '</a>'
        }
        result += arrayToHtml(item.children, depth)
        return result + '</li>'
      }).join('\n') + '\n</ul>\n'
  }
  return new Handlebars.SafeString(arrayToHtml(toc, depth || 6))
})

var whiteList = {
  'self': 1,
  'onmessage': 1,
  'postMessage': 1,
  'global': 1,
  'whiteList': 1,
  'eval': 1,
  'Array': 1,
  'Boolean': 1,
  'Date': 1,
  'Function': 1,
  'Number': 1,
  'Object': 1,
  'RegExp': 1,
  'String': 1,
  'Error': 1,
  'EvalError': 1,
  'RangeError': 1,
  'ReferenceError': 1,
  'SyntaxError': 1,
  'TypeError': 1,
  'URIError': 1,
  'decodeURI': 1,
  'decodeURIComponent': 1,
  'encodeURI': 1,
  'encodeURIComponent': 1,
  'isFinite': 1,
  'isNaN': 1,
  'parseFloat': 1,
  'parseInt': 1,
  'Infinity': 1,
  'JSON': 1,
  'Math': 1,
  'NaN': 1,
  'undefined': 1,
  'safeEval': 1,
  'close': 1,
  'Handlebars': 1
}

var global = this
while (global !== Object.prototype) {
  Object.getOwnPropertyNames(global).forEach(function (prop) {
    if (!whiteList.hasOwnProperty(prop)) {
      try {
        Object.defineProperty(global, prop, {
          get: function () {
            throw new Error('Security Exception: cannot access ' + prop)
          },
          configurable: false
        })
      } catch (e) {}
    }
  })
  global = Object.getPrototypeOf(global)
}

function safeEval (code) {
  'use strict'
  eval('"use strict";\n' + code) // eslint-disable-line no-eval
}

onmessage = function (evt) { // eslint-disable-line no-native-reassign, no-undef, no-unused-vars
  'use strict'
  var template = Handlebars.compile(evt.data[0])
  var context = evt.data[1]
  var result
  try {
    safeEval(evt.data[2])
    result = template(context)
  } catch (e) {
    result = 'Error: ' + e.toString()
  }
  postMessage(result)
  close()
}
