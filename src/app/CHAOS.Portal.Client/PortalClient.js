var CHAOS;
(function (CHAOS) {
    var Portal;
    (function (Portal) {
        var Client;
        (function (Client) {
            var PortalClient = (function () {
                function PortalClient(servicePath, clientGuid) {
                    if (clientGuid === void 0) { clientGuid = null; }
                    this._authenticationType = null;
                    if (servicePath == null || servicePath == "" || typeof servicePath != "string")
                        throw new Error("Parameter servicePath must be set to a valid path");
                    if (servicePath.substr(servicePath.length - 1, 1) != "/")
                        servicePath += "/";
                    this._servicePath = servicePath;
                    this.ClientGuid = clientGuid;
                    this._sessionAcquired = new Event(this);
                    this._sessionAuthenticated = new Event(this);
                }
                PortalClient.GetSessionParameterName = function () { return "sessionGUID"; };
                PortalClient.GetClientVersion = function () { return "2.14.1"; };
                PortalClient.GetProtocolVersion = function () { return 6; };
                PortalClient.prototype.GetServicePath = function () { return this._servicePath; };
                PortalClient.prototype.GetCurrentSession = function () { return this._currentSession; };
                PortalClient.prototype.HasSession = function () { return this.GetCurrentSession() != null; };
                PortalClient.prototype.IsAuthenticated = function () { return this._authenticationType != null; };
                PortalClient.prototype.AuthenticationType = function () { return this._authenticationType; };
                PortalClient.prototype.SessionAcquired = function () { return this._sessionAcquired; };
                PortalClient.prototype.SessionAuthenticated = function () { return this._sessionAuthenticated; };
                PortalClient.prototype.CallService = function (path, method, parameters, requiresSession, format) {
                    if (method === void 0) { method = Client.HttpMethod.Get; }
                    if (parameters === void 0) { parameters = null; }
                    if (requiresSession === void 0) { requiresSession = true; }
                    if (format === void 0) { format = "json2"; }
                    if (requiresSession)
                        parameters = this.AddSessionToParameters(parameters, path);
                    return new CallState(this, this._callHandler).Call(this.GetPathToExtension(path), method, format, parameters);
                };
                PortalClient.prototype.GetServiceCallUri = function (path, parameters, requiresSession, format) {
                    if (parameters === void 0) { parameters = null; }
                    if (requiresSession === void 0) { requiresSession = true; }
                    if (format === void 0) { format = "json2"; }
                    if (requiresSession)
                        parameters = this.AddSessionToParameters(parameters, path);
                    return this.GetPathToExtension(path) + "?" + ServiceCall.CreateDataStringWithPortalParameters(parameters, format);
                };
                PortalClient.prototype.SetCallHandler = function (handler) {
                    this._callHandler = handler;
                };
                PortalClient.prototype.GetPathToExtension = function (path) {
                    return this.GetServicePath() + "v" + PortalClient.GetProtocolVersion() + "/" + path;
                };
                PortalClient.prototype.AddSessionToParameters = function (parameters, path, method) {
                    if (parameters == null)
                        parameters = {};
                    if (!this.HasSession())
                        throw new Error("Session is not acquired, but is required for: " + path);
                    parameters[PortalClient.GetSessionParameterName()] = this.GetCurrentSession().Guid;
                    return parameters;
                };
                PortalClient.prototype.UpdateSession = function (session) {
                    var hadSession = this._currentSession != null;
                    this._currentSession = session;
                    if (!hadSession && session != null)
                        this._sessionAcquired.Raise(session);
                    else if (session == null)
                        this._authenticationType = null;
                };
                PortalClient.prototype.SetSessionAuthenticated = function (type, userGuid, sessionDateModified) {
                    this._authenticationType = type;
                    if (type != null) {
                        if (userGuid != null)
                            this._currentSession.UserGuid = userGuid;
                        if (sessionDateModified != null)
                            this._currentSession.DateModified = sessionDateModified;
                        this._sessionAuthenticated.Raise(type);
                    }
                };
                return PortalClient;
            })();
            Client.PortalClient = PortalClient;
            var CallState = (function () {
                function CallState(serviceCaller, callHandler) {
                    this._call = null;
                    this._completed = new Event(this);
                    this._progressChanged = new Event(this);
                    this._serviceCaller = serviceCaller;
                    this._callHandler = callHandler;
                }
                CallState.prototype.TransferProgressChanged = function () {
                    return this._progressChanged;
                };
                CallState.prototype.Call = function (path, method, format, parameters) {
                    var _this = this;
                    if (parameters === void 0) { parameters = null; }
                    if (this._call != null)
                        throw new Error("Call can not be called multiple times");
                    this._call = new ServiceCall();
                    this._call.Call(function (response) {
                        var recaller = function (resetSession) {
                            _this._call = null;
                            if (resetSession) {
                                var sessionName = PortalClient.GetSessionParameterName();
                                for (var key in parameters) {
                                    if (key == sessionName) {
                                        parameters[key] = _this._serviceCaller.GetCurrentSession().Guid;
                                        break;
                                    }
                                }
                            }
                            _this.Call(path, method, format, parameters);
                        };
                        if (_this._callHandler == null || _this._callHandler.ProcessResponse(response, recaller))
                            _this._completed.Raise(response);
                    }, function (progress) { return _this._progressChanged.Raise(progress); }, path, method, format, parameters);
                    return this;
                };
                CallState.prototype.WithCallback = function (callback, context) {
                    if (context === void 0) { context = null; }
                    if (context == null)
                        this._completed.Add(callback);
                    else
                        this._completed.Add(function (response) { return callback.call(context, response); });
                    return this;
                };
                CallState.prototype.WithCallbackAndToken = function (callback, token, context) {
                    if (context === void 0) { context = null; }
                    if (context == null)
                        this._completed.Add(function (response) { return callback(response, token); });
                    else
                        this._completed.Add(function (response) { return callback.call(context, response, token); });
                    return this;
                };
                return CallState;
            })();
            var ServiceCall = (function () {
                function ServiceCall() {
                }
                ServiceCall.prototype.Call = function (completeCallback, progressCallback, path, method, format, parameters) {
                    if (parameters === void 0) { parameters = null; }
                    this._completeCallback = completeCallback;
                    this._progressCallback = progressCallback;
                    parameters = ServiceCall.AddPortalParameters(parameters, format);
                    if (window["FormData"])
                        this.CallWithXMLHttpRequest2Browser(path, method, parameters);
                    else if (window["XMLHttpRequest"])
                        this.CallWithXMLHttpRequestBrowser(path, method, parameters);
                    else if (window["XDomainRequest"] || window["ActiveXObject"])
                        this.CallWithOldIEBrowser(path, method, parameters);
                    else
                        throw new Error("Browser does not supper AJAX requests");
                };
                ServiceCall.prototype.CallWithXMLHttpRequest2Browser = function (path, method, parameters) {
                    var _this = this;
                    if (parameters === void 0) { parameters = null; }
                    this._request = new XMLHttpRequest();
                    var data = null;
                    if (method == Client.HttpMethod.Get)
                        path += "?" + ServiceCall.CreateDataString(parameters);
                    else {
                        parameters = ServiceCall.ConvertDatesToCorrectFormat(ServiceCall.RemoveNullParameters(parameters));
                        data = new FormData();
                        for (var key in parameters)
                            data.append(key, parameters[key]);
                    }
                    this._request.onreadystatechange = function () { return _this.RequestStateChange(); };
                    this._request.upload.onprogress = function (event) { return _this.ReportProgressUpdate(event.loaded, event.total, event.lengthComputable); };
                    this._request.open(method == Client.HttpMethod.Get ? "GET" : "POST", path, true);
                    this._request.send(data);
                };
                ServiceCall.prototype.CallWithXMLHttpRequestBrowser = function (path, method, parameters) {
                    var _this = this;
                    if (parameters === void 0) { parameters = null; }
                    this._request = new XMLHttpRequest();
                    var data = ServiceCall.CreateDataString(parameters);
                    if (method == Client.HttpMethod.Get) {
                        path += "?" + data;
                        data = null;
                    }
                    this._request.onreadystatechange = function () { return _this.RequestStateChange(); };
                    this._request.open(method == Client.HttpMethod.Get ? "GET" : "POST", path, true);
                    if (method == Client.HttpMethod.Post)
                        this._request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                    this._request.send(data);
                };
                ServiceCall.prototype.CallWithOldIEBrowser = function (path, method, parameters) {
                    var _this = this;
                    if (parameters === void 0) { parameters = null; }
                    this._request = window["XDomainRequest"] ? new XDomainRequest() : new ActiveXObject("Microsoft.XMLHTTP");
                    var data = ServiceCall.CreateDataString(parameters);
                    if (method == Client.HttpMethod.Get) {
                        path += "?" + data;
                        data = null;
                    }
                    this._request.onload = function () { return _this.ReportCompleted(_this._request.responseText); };
                    this._request.onerror = this._request.ontimeout = function () { return _this.ReportError(); };
                    this._request.open(method == Client.HttpMethod.Get ? "GET" : "POST", path);
                    this._request.send(data);
                    if (this._request.responseText != "")
                        setTimeout(function () { return _this.ReportCompleted(_this._request.responseText); }, 1);
                };
                ServiceCall.prototype.RequestStateChange = function () {
                    if (this._request.readyState != 4)
                        return;
                    if (this._request.status == 200)
                        this.ReportCompleted(this._request.responseText);
                    else
                        this.ReportError();
                };
                ServiceCall.prototype.ReportCompleted = function (responseText) {
                    if (this._completeCallback == null)
                        return;
                    var response = JSON && JSON.parse(responseText) || eval(responseText);
                    if (response.Error != null && response.Error.Fullname == null)
                        response.Error = null;
                    this._completeCallback(response);
                };
                ServiceCall.prototype.ReportProgressUpdate = function (bytesTransfered, totalBytes, totalBytesIsKnown) {
                    if (this._progressCallback == null)
                        return;
                    this._progressCallback({ BytesTransfered: bytesTransfered, TotalBytes: totalBytes, TotalBytesIsKnown: totalBytesIsKnown });
                };
                ServiceCall.prototype.ReportError = function () {
                    if (this._completeCallback == null)
                        return;
                    this._completeCallback({ Header: null, Body: null, Error: { Fullname: "ServiceError", Message: "Service call failed", Stacktrace: null, InnerException: null } });
                };
                ServiceCall.CreateDataStringWithPortalParameters = function (parameters, format) {
                    if (format === void 0) { format = "json2"; }
                    return ServiceCall.CreateDataString(ServiceCall.AddPortalParameters(parameters, format));
                };
                ServiceCall.CreateDataString = function (parameters) {
                    parameters = ServiceCall.ConvertDatesToCorrectFormat(ServiceCall.RemoveNullParameters(parameters));
                    var result = "";
                    var first = true;
                    for (var key in parameters) {
                        result += (first ? "" : "&") + key + "=" + encodeURIComponent(parameters[key]);
                        if (first)
                            first = false;
                    }
                    return result;
                };
                ServiceCall.ConvertDate = function (date) {
                    return ServiceCall.ToTwoDigits(date.getUTCDate()) + "-" + ServiceCall.ToTwoDigits(date.getUTCMonth() + 1) + "-" + date.getUTCFullYear() + " " + ServiceCall.ToTwoDigits(date.getUTCHours()) + ":" + ServiceCall.ToTwoDigits(date.getUTCMinutes()) + ":" + ServiceCall.ToTwoDigits(date.getUTCSeconds());
                };
                ServiceCall.AddPortalParameters = function (parameters, format) {
                    if (format === void 0) { format = "json2"; }
                    if (parameters == null)
                        parameters = {};
                    parameters["format"] = format;
                    parameters["userHTTPStatusCodes"] = "False";
                    return parameters;
                };
                ServiceCall.ConvertDatesToCorrectFormat = function (parameters) {
                    var value;
                    for (var key in parameters) {
                        value = parameters[key];
                        if (Client.Object.prototype.toString.call(value) === '[object Date]')
                            parameters[key] = ServiceCall.ConvertDate(value);
                    }
                    return parameters;
                };
                ServiceCall.RemoveNullParameters = function (parameters) {
                    var value;
                    for (var key in parameters) {
                        value = parameters[key];
                        if (value == null)
                            delete parameters[key];
                    }
                    return parameters;
                };
                ServiceCall.ToTwoDigits = function (value) {
                    return value < 10 ? "0" + value : value.toString();
                };
                return ServiceCall;
            })();
            var Event = (function () {
                function Event(sender) {
                    this.sender = sender;
                    this._handlers = [];
                    if (typeof sender === "undefined")
                        throw new Error("Parameter sender must be set");
                    this._sender = sender;
                }
                Event.prototype.Add = function (handler) {
                    if (handler == null)
                        throw new Error("handler must be defined");
                    this._handlers.push(handler);
                };
                Event.prototype.Remove = function (handler) {
                    if (handler == null)
                        throw new Error("handler must be defined");
                    for (var i = 0; i < this._handlers.length; i++) {
                        if (this._handlers[i] === handler) {
                            this._handlers.splice(i, 1);
                            return;
                        }
                    }
                };
                Event.prototype.Raise = function (data) {
                    for (var i = 0; i < this._handlers.length; i++)
                        this._handlers[i].call(this._sender, data);
                };
                return Event;
            })();
        })(Client = Portal.Client || (Portal.Client = {}));
    })(Portal = CHAOS.Portal || (CHAOS.Portal = {}));
})(CHAOS || (CHAOS = {}));
