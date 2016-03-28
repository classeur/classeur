angular.module('classeur.core.sync.contentSync', [])
  .factory('clContentSyncSvc',
    function ($rootScope, $timeout, $q, clRestSvc, clSetInterval, clSocketSvc, clUserSvc, clUserActivity, clSyncDataSvc, clFileSvc, clToast, clDiffUtils, clEditorSvc, clUserInfoSvc, clUid, clIsNavigatorOnline, clIsSyncWindow, clEditorLayoutSvc) {
      var loadingTimeout = 30 * 1000 // 30 sec
      var textMaxSize = 200000
      var backgroundUpdateContentEvery = 30 * 1000 // 30 sec
      var clContentSyncSvc = {}
      var watchCtx

      function setWatchCtx (ctx) {
        watchCtx = ctx
        clContentSyncSvc.watchCtx = ctx
      }
      clSocketSvc.addMsgHandler('userToken', setWatchCtx.cl_bind(null, null))

      function setLoadedContent (file, serverContent) {
        file.setLoaded()
        file.content.text = serverContent.text
        file.content.properties = ({}).cl_extend(serverContent.properties)
        file.content.discussions = ({}).cl_extend(serverContent.discussions)
        file.content.comments = ({}).cl_extend(serverContent.comments)
        file.content.conflicts = ({}).cl_extend(serverContent.conflicts)
        file.content.state = {}
        // addToDaos calls init
        if (!file.addToDaos) {
          clFileSvc.init() // Will delete the content if called while file is not in the daos
        }
      }

      function setLoadingError (file, error) {
        if (file.state === 'loading') {
          file.state = undefined
        }
        clToast(error || 'File not accessible: ' + (file.name || file.id))
      }

      function applyServerContent (file, oldContent, serverContent) {
        var newContent = {
          text: clEditorSvc.cledit.getContent(),
          properties: file.content.properties,
          discussions: file.content.discussions,
          comments: file.content.comments,
          conflicts: file.content.conflicts
        }
        var conflicts = clDiffUtils.mergeContent(oldContent, newContent, serverContent)
        file.content.properties = newContent.properties
        file.content.discussions = newContent.discussions
        file.content.comments = newContent.comments
        file.content.conflicts = newContent.conflicts
        clEditorSvc.setContent(newContent.text, true)
        if (conflicts.length) {
          conflicts.cl_each(function (conflict) {
            file.content.conflicts[clUid()] = conflict
          })
          clEditorLayoutSvc.currentControl = 'conflictAlert'
        }
      }

      function watchContent (file) {
        if (watchCtx) {
          if (file === watchCtx.file) {
            // File already being watched
            return
          } else {
            // Stop previous file watching
            clSocketSvc.sendMsg('stopWatchContent', {
              id: watchCtx.id
            })
            setWatchCtx()
          }
        }
        if (!file || !file.state || file.isLocalFile || !clSyncDataSvc.files[file.id]) {
          return
        }
        file.loadPending = false
        setWatchCtx({
          id: clUid(),
          file: file,
          userCursors: {},
          contentChanges: []
        })
        clSocketSvc.sendMsg('startWatchContent', {
          id: watchCtx.id,
          fileId: file.id,
          previousRev: file.content && file.content.syncedRev
        })
        $timeout.cancel(file.loadingTimeoutId)
        file.loadingTimeoutId = $timeout(function () {
          setLoadingError(file, 'Loading timeout.')
        }, loadingTimeout)
      }

      clSocketSvc.addMsgHandler('watchedContent', function (msg) {
        if (!watchCtx || !watchCtx.file.state || watchCtx.id !== msg.id) {
          return
        }
        var file = watchCtx.file
        $timeout.cancel(file.loadingTimeoutId)
        if (msg.error) {
          return setLoadingError(file)
        }
        var oldContent = clDiffUtils.flattenContent(msg.previousContent || msg.lastContent, true)
        var serverContent = clDiffUtils.flattenContent(msg.lastContent, true)
        if (file.state === 'loading') {
          setLoadedContent(file, serverContent)
        } else {
          applyServerContent(file, oldContent, serverContent)
        }
        watchCtx.chars = serverContent.chars
        watchCtx.text = serverContent.text
        watchCtx.properties = serverContent.properties
        watchCtx.discussions = serverContent.discussions
        watchCtx.comments = serverContent.comments
        watchCtx.conflicts = serverContent.conflicts
        watchCtx.rev = serverContent.rev
        // Evaluate scope synchronously to have cledit instantiated
        $rootScope.$apply()
        // Changes can be received before the watchedFile
        applyContentChangeMsgs()
      })

      function getPublicContent (file) {
        if (!file || !file.state || !file.loadPending || !file.userId || !clIsNavigatorOnline()) {
          return
        }
        var lastContent
        var syncedContent
        file.loadPending = false
        clRestSvc.request({
          method: 'GET',
          url: '/api/v2/files/' + file.id + '/contentRevs/last'
        })
          .then(function (res) {
            lastContent = res.body
            if (file.content && file.content.syncedRev < lastContent.rev) {
              return clRestSvc.request({
                method: 'GET',
                url: '/api/v2/files/' + file.id + '/contentRevs/' + file.content.syncedRev
              })
                .then(function (res) {
                  syncedContent = res.body
                })
            }
          })
          .then(function () {
            if (!file.content) {
              setLoadedContent(file, lastContent)
            } else {
              applyServerContent(file, syncedContent || lastContent, lastContent)
            }
            file.setContentSynced(lastContent.rev)
            // Evaluate scope synchronously to have cledit instantiated
            $rootScope.$apply()
          })
          .catch(function () {
            setLoadingError(file)
          })
      }

      var lastTooBigWarning = 0

      function tooBigWarning () {
        var currentDate = Date.now()
        if (currentDate - lastTooBigWarning > 30000) {
          clToast('File is too big!')
          lastTooBigWarning = currentDate
        }
      }

      function sendContentChange () {
        if (!watchCtx || watchCtx.rev === undefined || watchCtx.sentMsg) {
          return
        }
        if (watchCtx.file.userId && watchCtx.file.sharing !== 'rw') {
          return
        }
        var newText = clEditorSvc.cledit.getContent()
        if (newText.length > textMaxSize) {
          return tooBigWarning()
        }
        var textChanges = clDiffUtils.getTextPatches(watchCtx.text, newText)
        var propertiesPatches = clDiffUtils.getObjectPatches(watchCtx.properties, watchCtx.file.content.properties)
        var discussionsPatches = clDiffUtils.getObjectPatches(watchCtx.discussions, watchCtx.file.content.discussions)
        var commentsPatches = clDiffUtils.getObjectPatches(watchCtx.comments, watchCtx.file.content.comments)
        var conflictsPatches = clDiffUtils.getObjectPatches(watchCtx.conflicts, watchCtx.file.content.conflicts)
        if (!textChanges && !propertiesPatches && !discussionsPatches && !commentsPatches && !conflictsPatches) {
          return
        }
        var newRev = watchCtx.rev + 1
        watchCtx.sentMsg = {
          id: watchCtx.id,
          rev: newRev,
          text: textChanges,
          properties: propertiesPatches,
          discussions: discussionsPatches,
          comments: commentsPatches,
          conflicts: conflictsPatches
        }
        clSocketSvc.sendMsg('setContentChange', watchCtx.sentMsg)
      }

      function applyContentChangeMsgs () {
        if (watchCtx.rev === undefined) {
          return
        }
        var msg
        var apply
        var serverText = watchCtx.text
        var localText = clEditorSvc.cledit.getContent()
        var serverProperties = ({}).cl_extend(watchCtx.properties)
        var serverDiscussions = ({}).cl_extend(watchCtx.discussions)
        var serverComments = ({}).cl_extend(watchCtx.comments)
        var serverConflicts = ({}).cl_extend(watchCtx.conflicts)
        while ((msg = watchCtx.contentChanges[watchCtx.rev + 1])) {
          watchCtx.rev = msg.rev
          if (!msg.userId && watchCtx.sentMsg && msg.rev === watchCtx.sentMsg.rev) {
            // Has to be the previously sent message
            msg = watchCtx.sentMsg
            watchCtx.contentChanges[msg.rev] = watchCtx.sentMsg
          }
          var oldText = serverText
          watchCtx.chars = clDiffUtils.applyCharPatches(watchCtx.chars, msg.text || [], msg.userId || clSyncDataSvc.user.id)
          serverText = watchCtx.chars.cl_map(function (item) {
            return item[1]
          }).join('')
          apply |= !!(msg.properties || msg.discussions || msg.comments || msg.conflicts)
          clDiffUtils.applyFlattenedObjectPatches(serverProperties, msg.properties || [])
          clDiffUtils.applyFlattenedObjectPatches(serverDiscussions, msg.discussions || [])
          clDiffUtils.applyFlattenedObjectPatches(serverComments, msg.comments || [])
          clDiffUtils.applyFlattenedObjectPatches(serverConflicts, msg.conflicts || [])
          if (msg !== watchCtx.sentMsg) {
            var isServerTextChanges = oldText !== serverText
            var isLocalTextChanges = oldText !== localText
            var isTextSynchronized = serverText === localText
            if (!isTextSynchronized && isServerTextChanges) {
              if (isLocalTextChanges) {
                localText = clDiffUtils.quickPatch(oldText, serverText, localText)
              } else {
                localText = serverText
              }
              var offset = clEditorSvc.setContent(localText, true)
              var userCursor = watchCtx.userCursors[msg.userId] || {}
              userCursor.offset = offset
              watchCtx.userCursors[msg.userId] = userCursor
            }
            clUserInfoSvc.request(msg.userId)
          }
          watchCtx.sentMsg = undefined
        }
        watchCtx.file.content.properties = clDiffUtils.mergeObjects(watchCtx.properties, watchCtx.file.content.properties, serverProperties)
        watchCtx.file.content.discussions = clDiffUtils.mergeObjects(watchCtx.discussions, watchCtx.file.content.discussions, serverDiscussions)
        watchCtx.file.content.comments = clDiffUtils.mergeObjects(watchCtx.comments, watchCtx.file.content.comments, serverComments)
        watchCtx.file.content.conflicts = clDiffUtils.mergeObjects(watchCtx.conflicts, watchCtx.file.content.conflicts, serverConflicts)
        watchCtx.text = serverText
        watchCtx.properties = serverProperties
        watchCtx.discussions = serverDiscussions
        watchCtx.comments = serverComments
        watchCtx.conflicts = serverConflicts
        watchCtx.file.setContentSynced(watchCtx.rev)
        apply && $rootScope.$evalAsync()
      }

      clSocketSvc.addMsgHandler('contentChange', function (msg) {
        if (!watchCtx || watchCtx.id !== msg.id || watchCtx.rev >= msg.rev) {
          return
        }
        watchCtx.contentChanges[msg.rev] = msg
        applyContentChangeMsgs()
      })

      clContentSyncSvc.retrieveRevision = function (rev) {
        if (!watchCtx) {
          return
        }
        var toRev = watchCtx.rev
        while (watchCtx.contentChanges[toRev] && toRev > rev) {
          toRev--
        }
        var fileId = watchCtx.file.id
        return Promise.resolve()
          .then(function () {
            if (toRev !== rev) {
              return clRestSvc.list('/api/v2/files/' + fileId + '/contentChanges', null, rev, toRev - 1)
                .then(function (items) {
                  if (watchCtx && watchCtx.file.id === fileId) {
                    items.cl_each(function (item) {
                      watchCtx.contentChanges[item.rev] = item
                    })
                  }
                })
            }
          })
          .then(function () {
            var result = {
              text: watchCtx.text,
              properties: ({}).cl_extend(watchCtx.properties),
              discussions: ({}).cl_extend(watchCtx.discussions),
              comments: ({}).cl_extend(watchCtx.comments),
              conflicts: ({}).cl_extend(watchCtx.conflicts)
            }
            watchCtx.contentChanges.slice(rev + 1, watchCtx.rev + 1).reverse().cl_each(function (contentChange) {
              result.text = clDiffUtils.applyFlattenedTextPatchesReverse(result.text, contentChange.text || [])
              clDiffUtils.applyFlattenedObjectPatchesReverse(result.properties, contentChange.properties || [])
              clDiffUtils.applyFlattenedObjectPatchesReverse(result.discussions, contentChange.discussions || [])
              clDiffUtils.applyFlattenedObjectPatchesReverse(result.comments, contentChange.comments || [])
              clDiffUtils.applyFlattenedObjectPatchesReverse(result.conflicts, contentChange.conflicts || [])
            })
            return result
          })
      }

      clSetInterval(function () {
        if (!clSocketSvc.isReady || !clIsSyncWindow()) {
          return
        }

        // Send modified local files
        clFileSvc.readLocalFileChanges()
        clFileSvc.localFiles.cl_each(function (file) {
          if (
            clSyncDataSvc.files[file.id] && // exists on the server
            (!watchCtx || file !== watchCtx.file) && // is not being edited in the current tab
            Date.now() - file.content.lastChange > backgroundUpdateContentEvery // is not being edited in another tab
          ) {
            try {
              file.loadDoUnload(function () {
                if (!file.isContentSynced()) {
                  clRestSvc.request({
                    method: 'PATCH',
                    url: '/api/v2/files/' + file.id + '/contentRevs/' + (file.content.syncedRev === undefined ? 'last' : file.content.syncedRev),
                    body: {
                      text: file.content.text,
                      properties: file.content.properties,
                      discussions: file.content.discussions,
                      comments: file.content.comments,
                      conflicts: file.content.conflicts
                    }
                  })
                  .then(function (res) {
                    clFileSvc.readLocalFileChanges()
                    if (
                      file.content && // still local
                      (!watchCtx || file.id !== watchCtx.file.id) && // is not being edited in the current tab
                      Date.now() - file.content.lastChange > backgroundUpdateContentEvery // is not being edited in another tab
                    ) {
                      try {
                        file.loadDoUnload(function () {
                          file.content.text = res.body.text
                          file.content.properties = res.body.properties
                          file.content.discussions = res.body.discussions
                          file.content.comments = res.body.comments
                          file.content.conflicts = res.body.conflicts
                          file.setContentSynced(res.body.rev)
                          file.writeContent()
                        })
                        clFileSvc.writeLocalFileChanges()
                      } catch (e) {
                        // File is not local
                      }
                    }
                  })
                }
              })
            } catch (e) {
              // File is not local
            }
          }
        })
      }, backgroundUpdateContentEvery)

      $rootScope.$watch('currentFile', function (currentFile) {
        if (currentFile) {
          currentFile.loadPending = true
        }
        if (clSocketSvc.isReady) {
          watchContent(currentFile)
        } else if (!clSocketSvc.hasToken) {
          getPublicContent(currentFile)
        }
      })

      clSetInterval(function () {
        if (!clUserActivity.checkActivity()) {
          return
        }
        clFileSvc.readLocalFileChanges()
        if ($rootScope.currentFile && $rootScope.currentFile.state === 'loaded') {
          $rootScope.currentFile.writeContent()
        }
        clFileSvc.writeLocalFileChanges()
        if (clSocketSvc.isReady) {
          watchContent($rootScope.currentFile)
          sendContentChange()
        } else if (!clSocketSvc.hasToken) {
          getPublicContent($rootScope.currentFile)
        }
      }, 200)

      return clContentSyncSvc
    })
