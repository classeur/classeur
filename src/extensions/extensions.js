angular.module('classeur.extensions', [])
  .provider('clExtensionSvc', function () {
    var getOptionsListeners = []
    var initConverterListeners = []
    var sectionPreviewListeners = []
    var asyncPreviewListeners = []

    this.onGetOptions = function (listener) {
      getOptionsListeners.push(listener)
    }

    this.onInitConverter = function (priority, listener) {
      initConverterListeners[priority] = listener
    }

    this.onSectionPreview = function (listener) {
      sectionPreviewListeners.push(listener)
    }

    this.onAsyncPreview = function (listener) {
      asyncPreviewListeners.push(listener)
    }

    this.$get = function () {
      var clExtensionSvc = {
        getOptions: getOptions,
        initConverter: initConverter,
        sectionPreview: sectionPreview,
        asyncPreview: asyncPreview
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
    }
  })
