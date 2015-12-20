angular.module('classeur.core.button', [])
  .directive('clButton',
    function () {
      return {
        restrict: 'E',
        link: link
      }

      function link (scope, element, attrs) {
        var elt = element[0]
        attrs.size && elt.clanim.width(attrs.size).height(attrs.size)
        ;['width', 'height', 'top', 'right', 'bottom', 'left'].cl_each(function (attrName) {
          var attr = attrs[attrName]
          attr && elt.clanim[attrName](attr)
        })
        elt.clanim.start()
      }
    })
