angular.module('classeur.core.utils', [])
  .factory('clConfig',
    function ($window) {
      return $window.CL_CONFIG || {}
    })
  .factory('clVersion',
    function ($window) {
      var clVersion = angular.extend({}, $window.CL_VERSION || {})
      clVersion.getAssetPath = function (file) {
        return clVersion.classeur ? clVersion.classeur + '/' + file : file
      }
      return clVersion
    })
  .factory('clLocalStorage',
    function ($window) {
      return $window.localStorage
    })
  .factory('clDebug',
    function ($window) {
      return $window.debug || function () {
        return function () {} // In case debug is not available as we rely on engine.io to provide it
      }
    })
  .factory('clSetInterval',
    function () {
      return function (cb, interval) {
        interval = (1 + (Math.random() - 0.5) * 0.1) * interval | 0
        setInterval(cb, interval)
      }
    })
  .factory('clUid',
    function () {
      var alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
      var radix = alphabet.length
      var array = new Uint32Array(20)
      return function () {
        window.crypto.getRandomValues(array)
        return array.cl_map(function (value) {
          return alphabet[value % radix]
        }).join('')
      }
    })
  .factory('clHash',
    function () {
      return function (str) {
        var i = 0
        var hash = 0
        var c
        if (str.length === 0) return hash
        for (; i < str.length; i++) {
          c = str.charCodeAt(i)
          hash = ((hash << 5) - hash) + c
        }
        return hash
      }
    })
  .factory('clIsNavigatorOnline',
    function ($window) {
      return function () {
        return $window.navigator.onLine !== false
      }
    })
  .filter('clTimeSince',
    function () {
      // Credit: https://github.com/github/time-elements/
      var weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

      function pad (num) {
        return ('0' + num).slice(-2)
      }

      function strftime (time, formatString) {
        var day = time.getDay()
        var date = time.getDate()
        var month = time.getMonth()
        var year = time.getFullYear()
        var hour = time.getHours()
        var minute = time.getMinutes()
        var second = time.getSeconds()
        return formatString.replace(/%([%aAbBcdeHIlmMpPSwyYZz])/g, function (_arg) {
          var match
          var modifier = _arg[1]
          switch (modifier) {
            case '%':
              return '%'
            case 'a':
              return weekdays[day].slice(0, 3)
            case 'A':
              return weekdays[day]
            case 'b':
              return months[month].slice(0, 3)
            case 'B':
              return months[month]
            case 'c':
              return time.toString()
            case 'd':
              return pad(date)
            case 'e':
              return date
            case 'H':
              return pad(hour)
            case 'I':
              return pad(strftime(time, '%l'))
            case 'l':
              if (hour === 0 || hour === 12) {
                return 12
              } else {
                return (hour + 12) % 12
              }
              break
            case 'm':
              return pad(month + 1)
            case 'M':
              return pad(minute)
            case 'p':
              if (hour > 11) {
                return 'PM'
              } else {
                return 'AM'
              }
              break
            case 'P':
              if (hour > 11) {
                return 'pm'
              } else {
                return 'am'
              }
              break
            case 'S':
              return pad(second)
            case 'w':
              return day
            case 'y':
              return pad(year % 100)
            case 'Y':
              return year
            case 'Z':
              match = time.toString().match(/\((\w+)\)$/)
              return match ? match[1] : ''
            case 'z':
              match = time.toString().match(/\w([+-]\d\d\d\d) /)
              return match ? match[1] : ''
          }
        })
      }

      function RelativeTime (date) {
        this.date = date
      }

      RelativeTime.prototype.toString = function () {
        var ago = this.timeElapsed()
        if (ago) {
          return ago
        } else {
          return 'on ' + this.formatDate()
        }
      }

      RelativeTime.prototype.timeElapsed = function () {
        var ms = new Date().getTime() - this.date.getTime()
        var sec = Math.round(ms / 1000)
        var min = Math.round(sec / 60)
        var hr = Math.round(min / 60)
        var day = Math.round(hr / 24)
        if (ms < 0) {
          return 'just now'
        } else if (sec < 10) {
          return 'just now'
        } else if (sec < 45) {
          return sec + ' seconds ago'
        } else if (sec < 90) {
          return 'a minute ago'
        } else if (min < 45) {
          return min + ' minutes ago'
        } else if (min < 90) {
          return 'an hour ago'
        } else if (hr < 24) {
          return hr + ' hours ago'
        } else if (hr < 36) {
          return 'a day ago'
        } else if (day < 30) {
          return day + ' days ago'
        } else {
          return null
        }
      }

      // Private: Determine if the day should be formatted before the month name in
      // the user's current locale. For example, `9 Jun` for en-GB and `Jun 9`
      // for en-US.
      //
      // Returns true if the day appears before the month.
      function isDayFirst () {
        if (dayFirst !== null) {
          return dayFirst
        }

        if (!('Intl' in window)) {
          return false
        }

        var options = {day: 'numeric', month: 'short'}
        var formatter = new window.Intl.DateTimeFormat(undefined, options)
        var output = formatter.format(new Date(0))

        dayFirst = !!output.match(/^\d/)
        return dayFirst
      }
      var dayFirst = null

      // Private: Determine if the year should be separated from the month and day
      // with a comma. For example, `9 Jun 2014` in en-GB and `Jun 9, 2014` in en-US.
      //
      // Returns true if the date needs a separator.
      function isYearSeparator () {
        if (yearSeparator !== null) {
          return yearSeparator
        }

        if (!('Intl' in window)) {
          return true
        }

        var options = {day: 'numeric', month: 'short', year: 'numeric'}
        var formatter = new window.Intl.DateTimeFormat(undefined, options)
        var output = formatter.format(new Date(0))

        yearSeparator = !!output.match(/\d,/)
        return yearSeparator
      }
      var yearSeparator = null

      // Private: Determine if the date occurs in the same year as today's date.
      //
      // date - The Date to test.
      //
      // Returns true if it's this year.
      function isThisYear (date) {
        var now = new Date()
        return now.getUTCFullYear() === date.getUTCFullYear()
      }

      RelativeTime.prototype.formatDate = function () {
        var format = isDayFirst() ? '%e %b' : '%b %e'
        if (!isThisYear(this.date)) {
          format += isYearSeparator() ? ', %Y' : ' %Y'
        }
        return strftime(this.date, format)
      }

      return function (time) {
        return time && new RelativeTime(new Date(time)).toString()
      }
    })
  .factory('clDialog',
    function ($window, $rootScope, $q, $mdDialog) {
      var mdDialogShow = $mdDialog.show
      $rootScope.isDialogOpen = 0
      $mdDialog.show = function (optionsOrPreset) {
        if ($window.event && $window.event.type === 'click') {
          optionsOrPreset.targetEvent = $window.event
        }
        $rootScope.isDialogOpen++

        function close () {
          $rootScope.isDialogOpen--
        }
        return mdDialogShow.call($mdDialog, optionsOrPreset)
          .then(function (res) {
            close()
            return res
          }, function (err) {
            close()
            return $q.reject(err)
          })
      }
      return $mdDialog
    })
  .factory('clToast',
    function ($window, $mdToast) {
      var toastShown
      var hideDelay = 6000
      var resetFlag = $window.cledit.Utils.debounce(function () {
        toastShown = false
      }, 500)
      var result = function (text, action) {
        if (toastShown) {
          return
        }
        var toast = $mdToast.simple()
          .content(text)
          .action(action)
          .position('bottom right')
          .hideDelay(hideDelay)
        toastShown = true
        resetFlag()
        return $mdToast.show(toast)
      }
      result.hideDelay = hideDelay
      return result
    })
  .factory('clStateMgr',
    function ($rootScope, $location, clLocalStorage, clUid) {
      var stateKeyPrefix = 'state.'
      var stateMaxAge = 3600000 // 1 hour

      var currentDate = Date.now()
      var keyPrefix = /^state\.(.+)/
      Object.keys(clLocalStorage).cl_each(function (key) {
        if (key.charCodeAt(0) === 0x73 /* s */) {
          var match = key.match(keyPrefix)
          if (match) {
            var stateAge = parseInt(match[1].split('.')[1] || 0, 10)
            if (currentDate - stateAge > stateMaxAge) clLocalStorage.removeItem(key)
          }
        }
      })

      var clStateMgr = {
        saveState: function (state) {
          var stateId = clUid() + '.' + Date.now()
          clLocalStorage[stateKeyPrefix + stateId] = JSON.stringify(state)
          return stateId
        }
      }

      function checkState (stateId) {
        clStateMgr.state = undefined
        if (stateId) {
          var storedState = clLocalStorage[stateKeyPrefix + stateId]
          if (storedState) {
            clLocalStorage.removeItem(stateKeyPrefix + stateId)
            clStateMgr.checkedState = JSON.parse(storedState)
            clStateMgr.checkedState.$search = $location.search()
          }
        } else {
          clStateMgr.state = clStateMgr.checkedState
          clStateMgr.checkedState = undefined
        }
      }

      $rootScope.$on('$routeChangeStart', function (evt, next) {
        checkState(next.params.stateId)
      })

      return clStateMgr
    })
  .factory('clUrl',
    function () {
      return {
        file: function (file) {
          if (file.id) {
            return '/files/' + file.id
          } else {
            return ''
          }
        },
        docFile: function (fileName) {
          return this.file({
            fileName: fileName
          })
        },
        folder: function (folder) {
          if (folder.id) {
            return '/folders/' + folder.id
          } else {
            return ''
          }
        }
      }
    })
  .factory('clUrlSanitizer',
    function () {
      return function (url, addSlash) {
        if (!url) {
          return url
        }
        if (url.indexOf('http') !== 0) {
          url = 'http://' + url
        }
        if (addSlash && url.slice(-1) !== '/') {
          url += '/'
        }
        return url
      }
    })
  .factory('clRangeWrapper',
    function ($window) {
      return {
        wrap: function (range, eltProperties) {
          var rangeLength = ('' + range).length
          var wrappedLength = 0
          var treeWalker = $window.document.createTreeWalker(range.commonAncestorContainer, $window.NodeFilter.SHOW_TEXT)
          var startOffset = range.startOffset
          treeWalker.currentNode = range.startContainer
          if (treeWalker.currentNode.nodeType === $window.Node.TEXT_NODE || treeWalker.nextNode()) {
            do {
              if (treeWalker.currentNode.nodeValue !== '\n') {
                if (treeWalker.currentNode === range.endContainer && range.endOffset < treeWalker.currentNode.nodeValue.length) {
                  treeWalker.currentNode.splitText(range.endOffset)
                }
                if (startOffset) {
                  treeWalker.currentNode = treeWalker.currentNode.splitText(startOffset)
                  startOffset = 0
                }
                var elt = $window.document.createElement('span')
                for (var key in eltProperties) {
                  elt[key] = eltProperties[key]
                }
                treeWalker.currentNode.parentNode.insertBefore(elt, treeWalker.currentNode)
                elt.appendChild(treeWalker.currentNode)
              }
              wrappedLength += treeWalker.currentNode.nodeValue.length
              if (wrappedLength >= rangeLength) {
                break
              }
            }
            while (treeWalker.nextNode())
          }
        },
        unwrap: function (elts) {
          elts.cl_each(function (elt) {
            var child
            // Loop in case another wrapper has been added inside
            while ((child = elt.firstChild)) {
              if (child.nodeType === 3) {
                if (elt.previousSibling && elt.previousSibling.nodeType === 3) {
                  child.nodeValue = elt.previousSibling.nodeValue + child.nodeValue
                  elt.parentNode.removeChild(elt.previousSibling)
                }
                if (!child.nextSibling && elt.nextSibling && elt.nextSibling.nodeType === 3) {
                  child.nodeValue = child.nodeValue + elt.nextSibling.nodeValue
                  elt.parentNode.removeChild(elt.nextSibling)
                }
              }
              elt.parentNode.insertBefore(child, elt)
            }
            elt.parentNode.removeChild(elt)
          })
        }
      }
    })
  .factory('clDiffUtils',
    function ($window) {
      return $window.clDiffUtils
    })
  .directive('clInfiniteScroll',
    function ($timeout) {
      return {
        restrict: 'A',
        link: function (scope, element, attrs) {
          var elt = element[0]

          function trigger () {
            if (elt.scrollTop + elt.offsetHeight > elt.scrollHeight - 300) {
              scope.$eval(attrs.clInfiniteScroll) && $timeout(trigger)
            }
          }
          elt.addEventListener('scroll', trigger)
          scope.triggerInfiniteScroll = function () {
            $timeout(trigger)
          }
        }
      }
    })
  .directive('clEnterOk',
    function () {
      return {
        restrict: 'A',
        link: function (scope, element) {
          element[0].addEventListener('keydown', function (e) {
            // Check enter key
            if (e.which === 13) {
              e.preventDefault()
              scope.ok()
            }
          })
        }
      }
    })
  .directive('clFocus',
    function () {
      return {
        restrict: 'A',
        link: function (scope, element) {
          scope.focus = function () {
            setTimeout(function () {
              element[0].focus()
            }, 10)
          }
          scope.focus()
        }
      }
    })
