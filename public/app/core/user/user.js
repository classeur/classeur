angular.module('classeur.core.user', [])
    .factory('clUserSvc', function($http, clSettingSvc, clConstants) {
        clSettingSvc.setDefaultValue('defaultUserName', 'Anonymous');

        var clUserSvc = {
            isLoading: true
        };

        $http.get(clConstants.serverUrl + '/app/user/info')
            .success(function(data) {
                clUserSvc.isLoading = false;
                clUserSvc.user = data.user;
                clUserSvc.newUser = data.newUser;
            });

        return clUserSvc;
    })
    .directive('clNewUserForm', function($location, $http, clConstants, clToast, clUserSvc) {
        return {
            restrict: 'E',
            templateUrl: 'app/core/user/newUserForm.html',
            link: function(scope) {
                scope.close = function() {
                    $location.url('');
                };

                scope.create = function() {
                    if (!clUserSvc.newUser.name) {
                        return;
                    }
                    //scope.isLoading = true;
                    $http.post(clConstants.serverUrl + '/app/user/new', clUserSvc.newUser)
                        .success(function(data) {
                            console.log(data);
                        });
                };

                scope.$watch('userSvc.isLoading', function(isLoading) {
                    if (isLoading) {
                        return;
                    }
                    if (clUserSvc.user || !clUserSvc.newUser) {
                        return scope.close();
                    }
                    clUserSvc.newUser.syncFiles = true;
                    clUserSvc.newUser.syncSettings = true;
                });
            }
        };
    });
