angular.module('classeur.extensions', [])
  .factory('clExtensionSvc', function () {
    var clExtensionSvc = {
      onGetOptions: onGetOptions,
      onInitConverter: onInitConverter,
      onSectionPreview: onSectionPreview,
      onAsyncPreview: onAsyncPreview,
      getOptions: getOptions,
      initConverter: initConverter,
      sectionPreview: sectionPreview,
      asyncPreview: asyncPreview
    }

    var getOptionsListeners = []
    var initConverterListeners = []
    var sectionPreviewListeners = []
    var asyncPreviewListeners = []

    function onGetOptions (listener) {
      getOptionsListeners.push(listener)
    }

    function onInitConverter (priority, listener) {
      initConverterListeners[priority] = listener
    }

    function onSectionPreview (listener) {
      sectionPreviewListeners.push(listener)
    }

    function onAsyncPreview (listener) {
      asyncPreviewListeners.push(listener)
    }

    function getOptions (properties, isCurrentFile) {
      return getOptionsListeners.cl_reduce(function (options, listener) {
        listener(options, properties, isCurrentFile)
        return options
      }, {})
    }

    function initConverter (markdown, options, isCurrentFile) {
      // Use forEach as it's a sparsed array
      initConverterListeners.forEach(function (listener) {
        listener(markdown, options, isCurrentFile)
      })
    }

    function sectionPreview (elt, options) {
      sectionPreviewListeners.cl_each(function (listener) {
        listener(elt, options)
      })
    }

    function asyncPreview (options) {
      return Promise.all(asyncPreviewListeners.cl_map(function (listener) {
        return listener(options)
      }))
    }

    return clExtensionSvc
  })
