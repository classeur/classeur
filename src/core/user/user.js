angular.module('classeur.core.user', [])
    .factory('clUserSvc', function($rootScope, $location, clSettingSvc, clSocketSvc) {
        clSettingSvc.setDefaultValue('defaultUserName', 'Anonymous');

        function signin(token) {
            clSocketSvc.setToken(token);
            clSocketSvc.openSocket();
        }

        function signout() {
            clUserSvc.user = undefined;
            clSocketSvc.clearToken();
            clSocketSvc.closeSocket();
        }

        clSocketSvc.addMsgHandler('signedInUser', function(msg) {
            clUserSvc.user = msg.user;
            $rootScope.$apply();
        });

        clSocketSvc.addMsgHandler('invalidToken', function() {
            signout();
            $rootScope.$apply();
        });
        
        var clUserSvc = {
            isReady: false,
            signin: signin,
            signout: signout
        };

        return clUserSvc;
    })
    .directive('clNewUserForm', function($location, $http, clToast, clUserSvc, clStateMgr) {
        return {
            restrict: 'E',
            templateUrl: 'core/user/newUserForm.html',
            link: function(scope) {
                scope.close = function() {
                    $location.url('');
                };

                scope.create = function() {
                    if (!scope.newUser.name) {
                        return;
                    }
                    scope.isLoading = true;
                    $http.post('/ajax/user/new', {
                            name: scope.newUser.name,
                            syncFilesAndSettings: scope.newUser.syncFilesAndSettings,
                            token: clStateMgr.token
                        })
                        .success(function(userToken) {
                            clUserSvc.signin(userToken);
                            $location.url('');
                        })
                        .error(function(data, status) {
                            clToast(data.reason || 'Error: ' + status);
                        });
                };

                if (!clStateMgr.token) {
                    return scope.close();
                }

                // Decode JWT
                var data = clStateMgr.token && clStateMgr.token.split('.');
                try {
                    scope.newUser = JSON.parse(atob(data[1]));
                } catch (e) {
                    return scope.close();
                }

                if (scope.newUser.type === 'user') {
                    clUserSvc.signin(clStateMgr.token);
                    return scope.close();
                }

                scope.newUser.syncFilesAndSettings = true;
            }
        };
    });
