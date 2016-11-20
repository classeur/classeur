angular.module('classeur.core.filePropertiesDialog', [])
  .factory('clFilePropertiesDialog',
    function (clDialog, clToast, clFilePropertiesSvc) {
      return function (properties) {
        properties = properties || {}

        return clDialog.show({
          templateUrl: 'core/filePropertiesDialog/filePropertiesDialog.html',
          controller: ['$scope', function (scope) {
            scope.addRow = function () {
              scope.properties.push({})
            }

            function makeScopeProperties (properties) {
              scope.properties = Object.keys(properties).sort().cl_map(function (key) {
                return {
                  key: key,
                  value: properties[key]
                }
              })
              scope.addRow()
            }
            makeScopeProperties(properties)

            function propertiesToPropertiesDesc () {
              scope.propertiesDesc = clFilePropertiesSvc.propertiesDesc.cl_reduce(function (result, propertyDesc, name) {
                var property = {}
                scope.properties.cl_some(function (entry) {
                  if (entry.key === name) {
                    property = entry
                    return true
                  }
                })
                result[name] = {
                  value: propertyDesc.deserialize(property.value)
                }.cl_extend(propertyDesc)
                return result
              }, {})
            }
            propertiesToPropertiesDesc()

            function propertiesDescToProperties () {
              scope.propertiesDesc.cl_each(function (propertyDesc, name) {
                scope.properties.push({
                  key: name,
                  value: propertyDesc.serialize(propertyDesc.value)
                })
              })
              makeScopeProperties(scope.properties.cl_reduce(function (properties, property) {
                if (property.key) {
                  if (property.value) {
                    properties[property.key] = property.value
                  } else {
                    delete properties[property.key]
                  }
                }
                return properties
              }, {}))
            }

            scope.$watch('tabIndex', function (tabIndex) {
              if (tabIndex === 0) {
                propertiesToPropertiesDesc()
              } else {
                propertiesDescToProperties()
              }
            })

            scope.deleteRow = function (propertyToDelete) {
              scope.properties = scope.properties.cl_filter(function (property) {
                return property !== propertyToDelete
              })
            }

            scope.ok = function () {
              if (scope.tabIndex === 0) {
                propertiesDescToProperties()
              }
              var properties = {}
              if (Object.keys(scope.properties).length > 100) {
                return clToast('Too many properties.')
              }
              if (
                scope.properties.cl_some(function (property) {
                  if (!property.key && !property.value) {
                    return
                  }
                  if (!property.key) {
                    clToast("Property can't be empty.")
                    return true
                  }
                  if (property.key.length > 100) {
                    clToast('Property key is too long.')
                    return true
                  }
                  if (!property.value) {
                    clToast("Property can't be empty.")
                    return true
                  }
                  if (property.value.length > 500) {
                    clToast('Property value is too long.')
                    return true
                  }
                  if (properties.hasOwnProperty(property.key)) {
                    clToast('Duplicate property: ' + property.key + '.')
                    return true
                  }
                  properties[property.key] = property.value
                })
              ) {
                return
              }
              clDialog.hide(properties)
            }
            scope.cancel = function () {
              clDialog.cancel()
            }
          }]
        })
      }
    })
  .factory('clFilePropertiesSvc',
    function ($templateCache, $rootScope) {
      var propertiesDesc = JSON.parse($templateCache.get('core/filePropertiesDialog/propertyDescriptors.json'))

      var clFilePropertiesSvc = {
        propertiesDesc: propertiesDesc,
        getCurrentFilePropertiesDesc: getCurrentFilePropertiesDesc,
        setCurrentFilePropertiesDesc: setCurrentFilePropertiesDesc
      }

      propertiesDesc.cl_each(function (propertyDesc, name) {
        propertyDesc.serialize = function (val) {
          return val
            ? val.toString()
            : undefined
        }
        propertyDesc.deserialize = function (val) {
          return val
        }
        switch (propertyDesc.type) {
          case 'checkbox':
            propertyDesc.serialize = function (val) {
              val = !!val
              return val === propertyDesc.default
                ? undefined
                : (!!val).toString()
            }
            propertyDesc.deserialize = function (val) {
              switch (val) {
                case 'true':
                  return true
                case 'false':
                  return false
                default:
                  return propertyDesc.default
              }
            }
            break
        }
      })

      function getCurrentFilePropertiesDesc () {
        if (!$rootScope.currentFile || !$rootScope.currentFile.content) {
          return {}
        }
        return propertiesDesc.cl_reduce(function (result, propertyDesc, name) {
          result[name] = {
            value: propertyDesc.deserialize($rootScope.currentFile.content.properties[name])
          }.cl_extend(propertyDesc)
          return result
        }, {})
      }

      function setCurrentFilePropertiesDesc (propertiesDesc) {
        if ($rootScope.currentFile && $rootScope.currentFile.content) {
          propertiesDesc.cl_each(function (propertyDesc, name) {
            var value = propertyDesc.serialize(propertyDesc.value)
            if (value) {
              $rootScope.currentFile.content.properties[name] = value
            } else {
              delete $rootScope.currentFile.content.properties[name]
            }
          })
        }
      }

      return clFilePropertiesSvc
    })
