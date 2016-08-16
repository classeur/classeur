angular.module('classeur.optional.zenMode', [])
  .directive('clZenModeSettings',
    function (clZenModeSvc, clLocalSettingSvc, clToast) {
      return {
        restrict: 'E',
        scope: true,
        templateUrl: 'optional/zenMode/zenModeSettings.html',
        link: link
      }

      function link (scope) {
        scope.zenModeSvc = clZenModeSvc
        scope.$watch('localSettingSvc.values.zenMode', function (value) {
          clZenModeSvc.enabled = value && !clLocalSettingSvc.values.sidePreview
        })
        scope.$watch('zenModeSvc.enabled', function (value) {
          if (clLocalSettingSvc.values.sidePreview) {
            if (value) {
              clToast('Not possible with side preview.')
              clZenModeSvc.enabled = false
            }
          } else {
            clLocalSettingSvc.values.zenMode = value
          }
        })
        scope.$watch('localSettingSvc.values.sidePreview', function (value) {
          clZenModeSvc.enabled = value
            ? false
            : clLocalSettingSvc.values.zenMode
        })
      }
    })
  .directive('clZenMode',
    function ($window, clEditorLayoutSvc, clZenModeSvc, clThrottle) {
      return {
        restrict: 'E',
        templateUrl: 'optional/zenMode/zenMode.html',
        link: link
      }

      function link (scope, element) {
        var zenPanelElt = element[0].querySelector('.zen-panel').clanim.width(4000).right(-1500).start()
        var zenPanelInnerElt = element[0].querySelector('.zen-panel__inner')
        var parentNode = element[0].parentNode
        var lastClientX
        var lastClientY
        var isHidden = true
        var isTyping

        function isEnabled () {
          return isTyping &&
          clZenModeSvc.enabled &&
          clEditorLayoutSvc.isEditorOpen &&
          !clEditorLayoutSvc.isMenuOpen
        }

        var showLevel1 = clThrottle(function () {
          if (!isEnabled()) {
            return
          }
          zenPanelElt.classList.remove('zen-panel--hidden')
          zenPanelElt.offsetWidth
          zenPanelElt.clanim
            .opacity(1)
            .duration(1500)
            .easing('ease-out')
            .start(true)
          isHidden = false
        }, 800)

        var showLevel2 = clThrottle(function () {
          isEnabled() && zenPanelInnerElt.clanim
            .opacity(1)
            .duration(300)
            .easing('ease-out')
            .start(true)
        }, 400)

        function hidePanel (evt) {
          var unhide = true
          if (isEnabled()) {
            if (evt) {
              if (evt.type === 'mousemove' && lastClientX === evt.clientX && lastClientY === evt.clientY) {
                return
              }
              lastClientX = evt.clientX
              lastClientY = evt.clientY
              var minLeft = parentNode.getBoundingClientRect().left + parentNode.offsetWidth
              if (evt.clientX < minLeft) {
                unhide = false
              }
              zenPanelInnerElt.clanim
                .duration(100)
                .opacity(0.8)
                .easing('ease-out')
                .start(true)
            }
            showLevel1()
            showLevel2()
          }
          if (unhide && !isHidden) {
            zenPanelElt.clanim
              .opacity(0)
              .duration(100)
              .easing('ease-out')
              .start(true, function () {
                isHidden = true
                isTyping = false
                zenPanelElt.classList.add('zen-panel--hidden')
              })
          }
        }

        zenPanelElt.clanim.opacity(0).start()
        hidePanel()
        var editorLayoutElt = document.querySelector('.editor-layout')
        editorLayoutElt.addEventListener('keydown', function (evt) {
          if (evt.altKey || evt.ctrlKey || evt.metaKey) {
            return
          }
          isTyping = true
          showLevel1()
          showLevel2()
        })
        $window.addEventListener('mousemove', hidePanel)
        $window.addEventListener('click', hidePanel)

        scope.$watch('editorLayoutSvc.isEditorOpen', hidePanel.cl_bind(null, null))
        scope.$on('$destroy', function () {
          $window.removeEventListener('mousemove', hidePanel)
          $window.removeEventListener('click', hidePanel)
        })
      }
    })
  .factory('clZenModeSvc',
    function (clLocalSettingSvc) {
      return {
        enabled: clLocalSettingSvc.values.zenMode
      }
    })
