angular.module('classeur.core.editorLayout', [])
  .directive('clFileName',
    function (clEditorLayoutSvc) {
      return {
        restrict: 'E',
        templateUrl: 'core/editorLayout/fileName.html',
        link: link
      }

      function link (scope) {
        var file = scope.currentFile
        scope.name = function (name) {
          if (name) {
            file.name = name
          } else if (!file.name) {
            file.name = 'Untitled'
          }
          return file.name
        }
        scope.name()
        scope.keydown = function (e) {
          if (e.which === 27) {
            scope.nameForm.$rollbackViewValue()
            clEditorLayoutSvc.currentControl = undefined
          } else if (e.which === 13) {
            clEditorLayoutSvc.currentControl = undefined
          }
        }
      }
    })
  .directive('clEditorLayout',
    function ($window, clEditorLayoutSvc, clSettingSvc, clLocalSettingSvc, clEditorSvc, clFilePropertiesDialog) {
      var hideOffsetY = 2000

      return {
        restrict: 'E',
        templateUrl: 'core/editorLayout/editorLayout.html',
        link: link
      }

      function link (scope, element) {
        var elt = element[0]
        elt.querySelector('.sidebar').clanim.width(clEditorLayoutSvc.sideBarWidth).start()
        var editorLayoutElt = elt.querySelector('.editor-layout')
        var previewElt = elt.querySelector('.editor-layout__preview')
        var previewInnerElt = elt.querySelector('.preview')
        var binderElt = elt.querySelector('.editor-binder').clanim.top(-hideOffsetY).start()
        var binderInner1Elt = elt.querySelector('.editor-binder__inner-1').clanim.top(hideOffsetY).start()
        var binderInner2Elt = elt.querySelector('.editor-binder__inner-2')
        var pageElt = elt.querySelector('.page').clanim.left(clEditorLayoutSvc.pageMarginLeft).start()
        var editorElt = elt.querySelector('.editor')
        var editorInnerElt = elt.querySelector('.editor__inner')
        elt.querySelector('.menu__scroller').clanim.width(clEditorLayoutSvc.menuWidth + 50).right(-50).start()
        elt.querySelector('.menu__inner').clanim.width(clEditorLayoutSvc.menuWidth).start()
        elt.querySelector('.right-margin').clanim.width(clEditorLayoutSvc.editorBtnGrpWidth).right(-clEditorLayoutSvc.editorBtnGrpWidth).start()
        var cornerFoldElt = elt.querySelector('.corner-fold__inner')
        elt.querySelector('.corner-fold__shadow').clanim.rotate(-45).start()
        var navbarElt = clEditorLayoutSvc.navbarElt = elt.querySelector('.navbar')
        var animatedBtnElt = elt.querySelector('.navbar__animated-btn')
        var closeBtnElt = elt.querySelector('.navbar__btn--close')
        var scrollBtnElt = elt.querySelector('.navbar__btn--scroll')

        editorElt.style.paddingLeft = clEditorLayoutSvc.editorLeftOverflow + 'px'
        editorElt.style.left = -clEditorLayoutSvc.editorLeftOverflow + 'px'

        var binderMinWidth = 280
        var previewSizeAdjust = 160
        var leftMarginOverflow = 90
        var binderWidthFactor = (clSettingSvc.values.editorBinderWidthFactor + 10) / 15
        var fontSizeFactor = (clSettingSvc.values.editorFontSizeFactor + 10) / 15

        function updateLayout () {
          var bgWidth = document.body.clientWidth
          if (clLocalSettingSvc.values.sideBar) {
            bgWidth -= clEditorLayoutSvc.sideBarWidth
          }
          clEditorLayoutSvc.fontSize = 18
          var factor = 1 + (clLocalSettingSvc.values.editorZoom - 3) * 0.1
          clEditorLayoutSvc.pageWidth = 990 * factor
          if (bgWidth < 1120) {
            --clEditorLayoutSvc.fontSize
            clEditorLayoutSvc.pageWidth = 910 * factor
          }
          if (bgWidth < 1040) {
            clEditorLayoutSvc.pageWidth = 830 * factor
          }
          if (bgWidth < binderMinWidth) {
            bgWidth = binderMinWidth
          }
          clEditorLayoutSvc.pageWidth *= binderWidthFactor
          var marginRight = (bgWidth - clEditorLayoutSvc.pageWidth) / 2
          marginRight = marginRight > 0 ? marginRight : 0
          if (bgWidth + leftMarginOverflow < clEditorLayoutSvc.pageWidth) {
            clEditorLayoutSvc.pageWidth = bgWidth + leftMarginOverflow
          }
          if (clEditorLayoutSvc.pageWidth < 640) {
            --clEditorLayoutSvc.fontSize
          }
          clEditorLayoutSvc.fontSize *= fontSizeFactor
          if (clEditorLayoutSvc.isSidePreviewOpen) {
            if (bgWidth / 2 < binderMinWidth) {
              clEditorLayoutSvc.isSidePreviewOpen = false
            } else {
              var maxWidth = bgWidth / 2 + clEditorLayoutSvc.editorBtnGrpWidth + leftMarginOverflow

              if (maxWidth < clEditorLayoutSvc.pageWidth) {
                clEditorLayoutSvc.pageWidth = maxWidth
              }
              marginRight = bgWidth / 2 - clEditorLayoutSvc.editorBtnGrpWidth
            }
          }
          if (clLocalSettingSvc.values.sideBar && document.body.clientWidth < binderMinWidth + clEditorLayoutSvc.sideBarWidth) {
            clLocalSettingSvc.values.sideBar = false
          }

          clEditorLayoutSvc.editorLayoutX = clLocalSettingSvc.values.sideBar ? -clEditorLayoutSvc.sideBarWidth : 0
          clEditorLayoutSvc.binderWidth = clEditorLayoutSvc.pageWidth - clEditorLayoutSvc.editorBtnGrpWidth
          clEditorLayoutSvc.binderX = bgWidth - (clEditorLayoutSvc.pageWidth + clEditorLayoutSvc.editorBtnGrpWidth) / 2 - marginRight
          clEditorLayoutSvc.binderX += clLocalSettingSvc.values.sideBar ? clEditorLayoutSvc.sideBarWidth : 0
          clEditorLayoutSvc.binderInnerX = clEditorLayoutSvc.isMenuOpen ? 8 : 0
          clEditorLayoutSvc.binderInnerY = clEditorLayoutSvc.isEditorOpen ? 0 : hideOffsetY
          clEditorLayoutSvc.navbarY = clEditorLayoutSvc.isEditorOpen ? -hideOffsetY : 0
          clEditorLayoutSvc.binderMargin = marginRight
          clEditorLayoutSvc.previewWidth = clEditorLayoutSvc.pageWidth - previewSizeAdjust + 2000
          clEditorLayoutSvc.previewHeaderWidth = clEditorLayoutSvc.pageWidth - previewSizeAdjust - 20
          clEditorLayoutSvc.previewX = clEditorLayoutSvc.binderX
          clEditorLayoutSvc.previewX += clEditorLayoutSvc.isSidePreviewOpen ? clEditorLayoutSvc.pageWidth - previewSizeAdjust / 2 + 15 : 20
          clEditorLayoutSvc.pageX = clEditorLayoutSvc.isMenuOpen ? -clEditorLayoutSvc.menuWidth : 0
          clEditorLayoutSvc.pageY = clEditorLayoutSvc.isMenuOpen ? -50 : 0
          clEditorLayoutSvc.pageRotate = clEditorLayoutSvc.isMenuOpen ? -2 : 0
        }

        function hidePreview () {
          if (clEditorLayoutSvc.isEditorOpen && !clEditorLayoutSvc.isSidePreviewOpen) {
            clEditorLayoutSvc.isPreviewVisible = false
            previewInnerElt.classList.add('hidden')
          }
        }

        function showPreview () {
          if (!clEditorLayoutSvc.isEditorOpen || clEditorLayoutSvc.isSidePreviewOpen) {
            clEditorLayoutSvc.isPreviewVisible = true
            previewInnerElt.classList.remove('hidden')
            previewInnerElt.offsetHeight // Force repaint
            updateLayoutSize() // Update width according to scrollbar visibility
          }
        }

        var sectionDescList

        function updateLayoutSize () {
          editorInnerElt.style.paddingBottom = document.body.clientHeight / 2 + 'px'
          var eltToScroll = clEditorSvc.editorElt.parentNode
          var dimensionKey = 'editorDimension'
          if (!clEditorLayoutSvc.isEditorOpen) {
            eltToScroll = clEditorSvc.previewElt.parentNode
            dimensionKey = 'previewDimension'
          }
          var scrollTop = eltToScroll.scrollTop
          var scrollSectionDesc, posInSection
          sectionDescList === clEditorSvc.sectionDescList && sectionDescList.cl_some(function (sectionDesc) {
            if (scrollTop < sectionDesc[dimensionKey].endOffset) {
              scrollSectionDesc = sectionDesc
              posInSection = (scrollTop - sectionDesc[dimensionKey].startOffset) / (sectionDesc[dimensionKey].height || 1)
              return true
            }
          })

          clEditorLayoutSvc.fontSizePx = clEditorLayoutSvc.fontSize + 'px'
          clEditorLayoutSvc.fontSizeEm = (7 + clLocalSettingSvc.values.editorZoom) / 10 + 'em'
          binderElt.clanim
            .width(clEditorLayoutSvc.binderWidth)
            .left(-clEditorLayoutSvc.binderWidth / 2)
            .start()
          previewElt.clanim
            .width(clEditorLayoutSvc.previewWidth)
            .left(-clEditorLayoutSvc.previewWidth / 2)
            .start()
          var pageWidth = clEditorLayoutSvc.binderWidth - clEditorLayoutSvc.pageMarginLeft - clEditorLayoutSvc.pageMarginRight
          pageElt.clanim
            .width(pageWidth)
            .start()
          editorElt.clanim
            .width(pageWidth + clEditorLayoutSvc.editorLeftOverflow)
            .start()
          hidePreview()
          clEditorSvc.previewElt.style.paddingTop = navbarElt.offsetHeight + 'px'

          if (scrollSectionDesc) {
            setTimeout(function () {
              clEditorSvc.measureSectionDimensions()
              scrollTop = scrollSectionDesc[dimensionKey].startOffset + scrollSectionDesc[dimensionKey].height * posInSection
              eltToScroll.scrollTop = scrollTop
            }, 10)
          }
        }

        function animateLayout () {
          showPreview()
          updateLayout()
          editorLayoutElt.clanim
            .translateX(clEditorLayoutSvc.editorLayoutX)
            .duration(isInited && 300)
            .easing('materialOut')
            .start()
          binderElt.clanim
            .translateX(clEditorLayoutSvc.binderX)
            .duration(isInited && 300)
            .easing('materialOut')
            .start()
          previewElt.clanim
            .translateX(clEditorLayoutSvc.previewX)
            .duration(isInited && 300)
            .easing('materialOut')
            .start(function () {
              setTimeout(function () {
                updateLayoutSize()
                scope.$apply()
              }, 100)
            })
        }

        animateLayout()
        updateLayoutSize()

        function animateEditor () {
          showPreview()
          updateLayout()
          navbarElt.clanim
            .translateY(clEditorLayoutSvc.navbarY)
            .duration(isInited && 300)
            .easing(clEditorLayoutSvc.isEditorOpen ? 'materialIn' : 'materialOut')
            .start(true)
          binderInner1Elt.clanim
            .translateY(clEditorLayoutSvc.binderInnerY)
            .duration(isInited && 300)
            .easing(clEditorLayoutSvc.isEditorOpen ? 'materialOut' : 'materialIn')
            .start(true, function () {
              hidePreview()
              clEditorLayoutSvc.toggleSidePreview(false)
              clEditorLayoutSvc.currentControl = undefined
              isInited && scope.$apply()
            })
        }

        function animateMenu () {
          updateLayout()
          pageElt.clanim
            .translateX(clEditorLayoutSvc.pageX)
            .translateY(clEditorLayoutSvc.pageY)
            .rotate(clEditorLayoutSvc.pageRotate)
            .duration(200)
            .easing('materialOut')
            .start(true)
          binderInner2Elt.clanim
            .translateX(clEditorLayoutSvc.binderInnerX)
            .duration(isInited && 200)
            .easing('materialOut')
            .start(true)
        }

        function animateCornerFolding () {
          if (!clEditorLayoutSvc.isCornerFoldingOpen) {
            clEditorLayoutSvc.isCornerFoldingVisible = false
          }
          cornerFoldElt.clanim
            .duration(isInited && 200)
            .scale(clEditorLayoutSvc.isCornerFoldingOpen ? 2.5 : 1)
            .start(true, function () {
              if (clEditorLayoutSvc.isCornerFoldingOpen) {
                clEditorLayoutSvc.isCornerFoldingVisible = true
                isInited && scope.$apply()
              }
            })
        }

        function animatePreviewButtons (isPreviewTop) {
          animatedBtnElt.clanim
            .duration(isInited && 200)
            .rotate(isPreviewTop ? 0 : 90)
            .start(true)
          closeBtnElt.clanim
            .zIndex(isPreviewTop ? 0 : -1)
            .opacity(isPreviewTop ? 1 : 0)
            .duration(isInited && 200)
            .easing('materialOut')
            .start(true)
          scrollBtnElt.clanim
            .zIndex(isPreviewTop ? -1 : 0)
            .opacity(isPreviewTop ? 0 : 1)
            .duration(isInited && 200)
            .easing('materialOut')
            .start(true)
        }

        scope.editFileProperties = function () {
          clEditorLayoutSvc.currentControl = 'editProperties'
          var file = scope.currentFile
          clFilePropertiesDialog(file.content.properties)
            .then(function (properties) {
              clEditorLayoutSvc.currentControl = undefined
              if (file === scope.currentFile) {
                file.content.properties = properties
              }
            }, function () {
              clEditorLayoutSvc.currentControl = undefined
            })
        }

        scope.toggleSidePreview = function () {
          clEditorLayoutSvc.toggleSidePreview()
          setTimeout(function () {
            clEditorSvc.cledit && clEditorSvc.cledit.focus()
          }, 100)
        }

        scope.openEditor = function () {
          clEditorLayoutSvc.toggleEditor(true)
          setTimeout(function () {
            clEditorSvc.cledit && clEditorSvc.cledit.focus()
          }, 100)
        }

        var tabs = ['sample', 'toc', 'discussions', 'history']
        scope.tabTitles = ['Markdown Sample', 'Table Of Contents', 'Discussions', 'History']
        scope.$watch('localSettingSvc.values.sideBarTab', function (tab) {
          scope.selectedTabIndex = tabs.indexOf(tab)
          scope.selectedTabIndex = ~scope.selectedTabIndex ? scope.selectedTabIndex : 0
        })
        scope.$watch('selectedTabIndex', function (index) {
          clLocalSettingSvc.values.sideBarTab = tabs[index || 0]
        })

        var isInited
        setTimeout(function () {
          isInited = true
        }, 1)

        var debouncedAnimateLayout = window.cledit.Utils.debounce(animateLayout, 50)
        window.addEventListener('resize', debouncedAnimateLayout)
        scope.$on('$destroy', function () {
          window.removeEventListener('resize', debouncedAnimateLayout)
          scope.unloadCurrentFile()
          clEditorLayoutSvc.clean()
        })

        scope.$watch('localSettingSvc.values.editorZoom', animateLayout)
        scope.$watch('localSettingSvc.values.editorColor', function (value) {
          scope.plasticClass = 'plastic--' + value
        })
        scope.$watch('editorLayoutSvc.isSidePreviewOpen', animateLayout)
        scope.$watch('editorLayoutSvc.isEditorOpen', animateEditor)
        scope.$watch('editorLayoutSvc.isMenuOpen', animateMenu)
        scope.$watch('localSettingSvc.values.sideBar', animateLayout)
        scope.$watch('editorLayoutSvc.isCornerFoldingOpen', animateCornerFolding)
        scope.$watch('editorLayoutSvc.currentControl === "menu"', function (isMenuOpen) {
          clEditorLayoutSvc.isMenuOpen = isMenuOpen
        })
        scope.$watch('editorSvc.isPreviewTop', animatePreviewButtons)
        scope.$watch('editorSvc.lastSectionMeasured', function () {
          sectionDescList = clEditorSvc.sectionDescList
        })
        scope.$watch('editorLayoutSvc.fontSizePx', function (fontSize) {
          editorElt.style.fontSize = fontSize
        })
      }
    })
  .factory('clEditorLayoutSvc',
    function ($window, $rootScope, clLocalSettingSvc) {
      var clEditorLayoutSvc = {
        pageMarginLeft: 4,
        pageMarginRight: 4,
        editorBtnGrpWidth: 36,
        menuWidth: 320,
        sideBarWidth: 280,
        editorLeftOverflow: 1000, // Allows scrolling on the left side of the editor
        init: function (hideEditor) {
          this.isEditorOpen = !hideEditor
          this.isSidePreviewOpen = false
          this.isMenuOpen = false
          this.isCornerFoldingOpen = false
        },
        toggleEditor: function (isOpen) {
          this.isEditorOpen = isOpen === undefined ? !this.isEditorOpen : isOpen
        },
        toggleSidePreview: function (isOpen) {
          this.isSidePreviewOpen = isOpen === undefined ? !this.isSidePreviewOpen : isOpen
        },
        toggleMenu: function () {
          this.currentControl = this.currentControl === 'menu' ? undefined : 'menu'
        },
        toggleSideBar: function (isOpen) {
          clLocalSettingSvc.values.sideBar = isOpen === undefined ? !clLocalSettingSvc.values.sideBar : isOpen
        },
        toggleStat: function (isOpen) {
          clLocalSettingSvc.values.stat = isOpen === undefined ? !clLocalSettingSvc.values.stat : isOpen
        },
        toggleCornerFold: function (isOpen) {
          this.isCornerFoldingOpen = isOpen === undefined ? !this.isCornerFoldingOpen : isOpen
        },
        clean: function () {
          this.currentControl = undefined
        }
      }

      $window.addEventListener('keydown', function (evt) {
        if (evt.which === 27) {
          // Esc key
          evt.preventDefault()
          clEditorLayoutSvc.currentControl = undefined
          $rootScope.$apply()
        }
      })

      return clEditorLayoutSvc
    })
