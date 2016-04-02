angular.module('classeur.core', [])
  .config(
    function ($routeProvider, $anchorScrollProvider, $locationProvider, $animateProvider, $mdThemingProvider) {
      $locationProvider.hashPrefix('!')
      $animateProvider.classNameFilter(/angular-animate|md-dialog-backdrop|md-bottom md-right/)
      $anchorScrollProvider.disableAutoScrolling()
      $mdThemingProvider.theme('default')
        .primaryPalette('blue')
        .accentPalette('blue')
      var menuTheme = $mdThemingProvider.theme('classeur', 'default')
      menuTheme.dark()
      menuTheme.foregroundShadow = ''
      window.BezierEasing.css.materialIn = window.BezierEasing(0.75, 0, 0.8, 0.25)
      window.BezierEasing.css.materialOut = window.BezierEasing(0.25, 0.8, 0.25, 1.0)

      $routeProvider
        .when('/files/:fileId', {
          template: '<div ng-switch="::fileLoaded"><cl-centered-spinner ng-switch-default></cl-centered-spinner><cl-editor-layout ng-switch-when="true"></cl-editor-layout></div>',
          controller: function ($scope, $routeParams, $location, clAnalytics, clToast, clFileSvc, clEditorLayoutSvc, clExplorerLayoutSvc, clSyncSvc) {
            clAnalytics.trackPage('/files')
            var publicFileDao = clFileSvc.createPublicFile($routeParams.fileId, true)
            var file = clFileSvc.activeDaoMap[$routeParams.fileId] || publicFileDao
            $scope.loadFile(file)
            if (!file.state) {
              clToast('You appear to be offline.')
              return $location.url('')
            }
            $scope.$watch('currentFile.state', function (state) {
              if (!state) {
                return $location.url('')
              } else if (state === 'loaded') {
                file.addToDaos && file.addToDaos()
                clEditorLayoutSvc.init(file.userId && file.isContentSynced())
                $scope.fileLoaded = true
              }
            })
          }
        })
        .when('/folders/:folderId', {
          template: '<cl-centered-spinner></cl-centered-spinner>',
          controller: function ($location, $routeParams, clAnalytics, clClasseurSvc, clFolderSvc, clExplorerLayoutSvc) {
            clAnalytics.trackPage('/folders')
            clExplorerLayoutSvc.refreshFolders()
            var folder = clFolderSvc.activeDaoMap[$routeParams.folderId]
            var classeur = clClasseurSvc.defaultClasseur
            if (!folder) {
              folder = clFolderSvc.createPublicFolder($routeParams.folderId)
              clClasseurSvc.addFolderToClasseur(classeur, folder)
              clClasseurSvc.init()
            } else {
              if (~clExplorerLayoutSvc.currentClasseur.folders.indexOf(folder)) {
                classeur = clExplorerLayoutSvc.currentClasseur
              } else {
                clClasseurSvc.activeDaos.cl_some(function (classeurToScan) {
                  if (~classeurToScan.folders.indexOf(folder)) {
                    classeur = classeurToScan
                    return true
                  }
                })
              }
            }
            clExplorerLayoutSvc.setCurrentClasseur(classeur)
            clExplorerLayoutSvc.setCurrentFolder(folder)
            $location.url('')
          }
        })
        .when('/classeurs/:classeurId', {
          template: '<cl-centered-spinner></cl-centered-spinner>',
          controller: function ($location, $routeParams, clAnalytics, clClasseurSvc, clExplorerLayoutSvc) {
            clAnalytics.trackPage('/classeurs')
            clExplorerLayoutSvc.refreshFolders()
            var classeur = clClasseurSvc.activeDaoMap[$routeParams.classeurId]
            if (!classeur) {
              classeur = clClasseurSvc.createPublicClasseur($routeParams.classeurId)
            }
            clExplorerLayoutSvc.setCurrentClasseur(classeur)
            $location.url('')
          }
        })
        .when('/states/:stateId', {
          template: '',
          controller: function ($location, clStateMgr) {
            $location.url(clStateMgr.checkedState ? clStateMgr.checkedState.url : '')
          }
        })
        .when('/', {
          template: '<cl-explorer-layout></cl-explorer-layout>',
          controller: function ($scope, clAnalytics, clFileSvc) {
            if (clFileSvc.activeDaos.length === 0) {
              return $scope.createDefaultFile()
            }
            clAnalytics.trackPage('/')
          }
        })
        .otherwise('/')
    })
  .run(
    function ($window, $rootScope, $location, $timeout, $interval, $route, clDialog, clExplorerLayoutSvc, clEditorLayoutSvc, clSettingSvc, clLocalSettingSvc, clEditorSvc, clFileSvc, clFolderSvc, clClasseurSvc, clUserSvc, clSocketSvc, clUserInfoSvc, clSyncDataSvc, clSyncSvc, clContentSyncSvc, clToast, clUrl, clConfig, clLocalStorage) {
      // Globally accessible services
      $rootScope.config = clConfig
      $rootScope.explorerLayoutSvc = clExplorerLayoutSvc
      $rootScope.editorLayoutSvc = clEditorLayoutSvc
      $rootScope.editorSvc = clEditorSvc
      $rootScope.fileSvc = clFileSvc
      $rootScope.folderSvc = clFolderSvc
      $rootScope.classeurSvc = clClasseurSvc
      $rootScope.socketSvc = clSocketSvc
      $rootScope.userSvc = clUserSvc
      $rootScope.userInfoSvc = clUserInfoSvc
      $rootScope.syncDataSvc = clSyncDataSvc
      $rootScope.syncSvc = clSyncSvc
      $rootScope.contentSyncSvc = clContentSyncSvc
      $rootScope.settingSvc = clSettingSvc
      $rootScope.localSettingSvc = clLocalSettingSvc

      function loadFile (file) {
        unloadCurrentFile()
        $rootScope.currentFile = file
        file.load && file.load()
      }

      function unloadCurrentFile () {
        $rootScope.currentFile && $rootScope.currentFile.unload()
        $rootScope.currentFile = undefined
      }

      function setCurrentFile (file, anchor) {
        unloadCurrentFile()
        file && $timeout(function () {
          $location.url(clUrl.file(file))
          $location.hash(anchor)
        })
      }

      function makeCurrentFileCopy () {
        var oldFileDao = $rootScope.currentFile
        var newFileDao = clFileSvc.createFile()
        newFileDao.state = 'loaded'
        newFileDao.readContent()
        newFileDao.name = oldFileDao.name.trim() + ' copy'
        newFileDao.content.text = oldFileDao.content.text
        newFileDao.content.state = JSON.parse(JSON.stringify(oldFileDao.content.state))
        newFileDao.content.properties = JSON.parse(JSON.stringify(oldFileDao.content.properties))
        newFileDao.content.discussions = JSON.parse(JSON.stringify(oldFileDao.content.discussions))
        newFileDao.content.comments = JSON.parse(JSON.stringify(oldFileDao.content.comments))
        newFileDao.writeContent()
        setCurrentFile(newFileDao)
        clToast('Copy created.')
      }

      function createDefaultFile () {
        var newFileDao = clFileSvc.createFile()
        newFileDao.state = 'loaded'
        newFileDao.readContent()
        newFileDao.name = clFileSvc.firstFileName
        newFileDao.content.text = clFileSvc.firstFileContent
        newFileDao.content.properties = clSettingSvc.values.defaultFileProperties || {}
        newFileDao.writeContent()
        setCurrentFile(newFileDao)
      }

      $rootScope.unloadCurrentFile = unloadCurrentFile
      $rootScope.setCurrentFile = setCurrentFile
      $rootScope.loadFile = loadFile
      $rootScope.makeCurrentFileCopy = makeCurrentFileCopy
      $rootScope.createDefaultFile = createDefaultFile

      // A counter to refresh times in the UI
      $rootScope.minuteCounter = 0
      $interval(function () {
        $rootScope.minuteCounter++
      }, 60 * 1000)

      $rootScope.$on('$routeChangeSuccess', function (event, current) {
        setTimeout(function () {
          document.title = $rootScope.currentFile ? $rootScope.currentFile.name : (current.$$route && current.$$route.title) || 'Classeur'
        }, 1)
      })

      var hasToken = clSocketSvc.hasToken
      $rootScope.$watch('socketSvc.hasToken', function (value) {
        if (!value && value !== hasToken) {
          var clearDataDialog = clDialog.confirm()
            .title("You've been signed out")
            .content('Would you like to clean all your local data?')
            .ariaLabel('Clean local data')
            .ok('Yes please')
            .cancel('No thanks')
          clDialog.show(clearDataDialog).then(function () {
            clSyncSvc.clearAll(function () {
              clLocalSettingSvc.values.explorerTourStep = -1
              clLocalSettingSvc.values.editorTourStep = -1
              createDefaultFile()
            })
          })
        }
        hasToken = value
      })

      $rootScope.$on('$routeChangeSuccess', function () {
        clDialog.cancel()
        clExplorerLayoutSvc.reset()
      })
    })
