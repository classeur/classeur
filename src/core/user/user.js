angular.module('classeur.core.user', [])
    .factory('clUserSvc', function($http, clSettingSvc) {
        clSettingSvc.setDefaultValue('defaultUserName', 'Anonymous');

        var clUserSvc = {
            isLoading: true
        };

        clUserSvc.getUserInfo = function() {
            return $http.get('/ajax/user/info')
                .then(function(res) {
                    clUserSvc.isLoading = false;
                    clUserSvc.user = res.data.user;
                    clUserSvc.newUser = res.data.newUser;
                    clUserSvc.existingUser = res.data.existingUser;
                });
        };

        clUserSvc.signout = function() {
            return $http.get('/ajax/user/signout')
                .then(function() {
                    delete clUserSvc.user;
                    delete clUserSvc.newUser;
                    delete clUserSvc.existingUser;
                });
        };

        clUserSvc.getUserInfo();
        return clUserSvc;
    })
    .directive('clNewUserForm', function($location, $http, clToast, clUserSvc) {
        return {
            restrict: 'E',
            templateUrl: 'core/user/newUserForm.html',
            link: function(scope) {
                scope.close = function() {
                    $location.url('');
                };

                scope.create = function() {
                    if (!clUserSvc.newUser.name) {
                        return;
                    }
                    //scope.isLoading = true;
                    $http.post('/ajax/user/new', clUserSvc.newUser)
                        .success(function(user) {
                            clUserSvc.user = user;
                            $location.url('');
                        })
                        .error(function(data, status) {
                            clToast(data.message || 'Error: ' + status);
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
