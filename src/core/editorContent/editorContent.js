angular.module('classeur.core.editorContent', [])
  .factory('clEditorContentSvc',
    function ($window, clUid, clDiffUtils) {
      var Marker = $window.cledit.Marker

      var clEditorContentSvc = {
        createCledit: createCledit,
        initCledit: initCledit,
        applyContent: applyContent,
        newDiscussionMarker0: new Marker(0),
        newDiscussionMarker1: new Marker(0, true)
      }

      var cledit
      var markerKeys
      var markerIdxMap
      var previousPatchableText
      var currentPatchableText
      var discussionMarkers
      function createCledit (elt, scrollerElt) {
        cledit = $window.cledit(elt, scrollerElt)
        markerKeys = []
        markerIdxMap = Object.create(null)
        discussionMarkers = {}
        cledit.on('contentChanged', onContentChanged)
        cledit.addMarker(clEditorContentSvc.newDiscussionMarker0)
        cledit.addMarker(clEditorContentSvc.newDiscussionMarker1)
        return cledit
      }

      var content
      function initCledit (newContent, options, reinit) {
        if (newContent) {
          options = angular.extend({}, options)

          if (content !== newContent) {
            content = newContent
            previousPatchableText = currentPatchableText = clDiffUtils.makePatchableText(content, markerKeys, markerIdxMap)
            syncDiscussionMarkers()
          }

          if (!reinit) {
            options.content = content.text
            options.selectionStart = content.state.selectionStart
            options.selectionEnd = content.state.selectionEnd
          }

          options.patchHandler = {
            makePatches: makePatches,
            applyPatches: applyPatches,
            reversePatches: reversePatches
          }
          cledit.init(options)
        }
      }

      var isChangePatch
      function onContentChanged (text) {
        content.text = text
        syncDiscussionMarkers()
        if (!isChangePatch) {
          previousPatchableText = currentPatchableText
          currentPatchableText = clDiffUtils.makePatchableText(content, markerKeys, markerIdxMap)
        } else {
          // Take a chance to restore discussion offsets on undo/redo
          content.text = currentPatchableText
          clDiffUtils.restoreDiscussionOffsets(content, markerKeys)
          content.discussions.cl_each(function (discussion, discussionId) {
            getDiscussionMarkers(discussion, discussionId, function (marker) {
              marker.offset = discussion[marker.offsetName]
            })
          })
        }
        isChangePatch = false
        clEditorContentSvc.lastChange = Date.now()
      }

      function syncDiscussionMarkers () {
        discussionMarkers.cl_each(function (marker, markerKey) {
          // Remove marker if discussion was removed
          var discussion = content.discussions[marker.discussionId]
          if (!discussion || discussion[marker.offsetName] === undefined) {
            cledit.removeMarker(marker)
            delete discussionMarkers[markerKey]
          }
        })

        content.discussions.cl_each(function (discussion, discussionId) {
          getDiscussionMarkers(discussion, discussionId, function (marker) {
            discussion[marker.offsetName] = marker.offset
          })
        })
      }

      function getDiscussionMarkers (discussion, discussionId, onMarker) {
        function getMarker (offsetName) {
          var markerOffset = discussion[offsetName]
          var markerKey = discussionId + offsetName
          var marker = discussionMarkers[markerKey]
          if (markerOffset !== undefined) {
            if (!marker) {
              marker = new Marker(markerOffset, offsetName === 'offset1')
              marker.discussionId = discussionId
              marker.offsetName = offsetName
              cledit.addMarker(marker)
              discussionMarkers[markerKey] = marker
            }
            onMarker(marker)
          }
        }
        getMarker('offset0')
        getMarker('offset1')
      }

      function applyContent (isExternal) {
        if (cledit) {
          if (isExternal) {
            clEditorContentSvc.lastExternalChange = Date.now()
          }
          syncDiscussionMarkers()
          return cledit.setContent(content.text, isExternal)
        }
      }

      /* eslint-disable new-cap */
      var diffMatchPatch = new window.diff_match_patch()
      /* eslint-enable new-cap */

      function makePatches () {
        var diffs = diffMatchPatch.diff_main(previousPatchableText, currentPatchableText)
        return diffMatchPatch.patch_make(previousPatchableText, diffs)
      }

      function applyPatches (patches) {
        var newPatchableText = diffMatchPatch.patch_apply(patches, currentPatchableText)[0]
        var result = newPatchableText
        if (markerKeys.length) {
          // Strip text markers
          result = result.replace(new RegExp('[\ue000-' + String.fromCharCode(0xe000 + markerKeys.length - 1) + ']', 'g'), '')
        }
        // Expect a `contentChanged` event
        if (result !== cledit.getContent()) {
          previousPatchableText = currentPatchableText
          currentPatchableText = newPatchableText
          isChangePatch = true
        }
        return result
      }

      function reversePatches (patches) {
        patches = diffMatchPatch.patch_deepCopy(patches).reverse()
        patches.cl_each(function (patch) {
          patch.diffs.cl_each(function (diff) {
            diff[0] = -diff[0]
          })
        })
        return patches
      }

      return clEditorContentSvc
    })
