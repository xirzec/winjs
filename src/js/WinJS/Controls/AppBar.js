﻿// Copyright (c) Microsoft Open Technologies, Inc.  All Rights Reserved. Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
// AppBar
/// <dictionary>appbar,appBars,Flyout,Flyouts,iframe,Statics,unfocus,WinJS</dictionary>
define([
    './AppBar/_Layouts',
    './AppBar/_Command',
    './AppBar/_Icon'
], function () {
    (function appBarInit(WinJS) {
        "use strict";

        WinJS.Namespace.define("WinJS.UI", {
            /// <field>
            /// <summary locid="WinJS.UI.AppBar">
            /// Represents an application toolbar for display commands. 
            /// </summary>
            /// </field>
            /// <icon src="ui_winjs.ui.appbar.12x12.png" width="12" height="12" />
            /// <icon src="ui_winjs.ui.appbar.16x16.png" width="16" height="16" />
            /// <htmlSnippet supportsContent="true"><![CDATA[<div data-win-control="WinJS.UI.AppBar">
            /// <button data-win-control="WinJS.UI.AppBarCommand" data-win-options="{id:'',label:'example',icon:'back',type:'button',onclick:null,section:'global'}"></button>
            /// </div>]]></htmlSnippet>
            /// <event name="beforeshow" locid="WinJS.UI.AppBar_e:beforeshow">Raised just before opening the AppBar.</event>
            /// <event name="aftershow" locid="WinJS.UI.AppBar_e:aftershow">Raised immediately after the AppBar is fully opened.</event>
            /// <event name="beforehide" locid="WinJS.UI.AppBar_e:beforehide">Raised just before closing the AppBar.</event>
            /// <event name="afterhide" locid="WinJS.UI.AppBar_e:afterhide">Raised immediately after the AppBar is fully closed.</event>
            /// <part name="appbar" class="win-commandlayout" locid="WinJS.UI.AppBar_part:appbar">The AppBar control itself.</part>
            /// <part name="appBarCustom" class="win-appbar" locid="WinJS.UI.AppBar_part:appBarCustom">Style for a custom layout AppBar.</part>
            /// <resource type="javascript" src="//$(TARGET_DESTINATION)/js/base.js" shared="true" />
            /// <resource type="javascript" src="//$(TARGET_DESTINATION)/js/ui.js" shared="true" />
            /// <resource type="css" src="//$(TARGET_DESTINATION)/css/ui-dark.css" shared="true" />
            AppBar: WinJS.Namespace._lazy(function () {
                var thisWinUI = WinJS.UI;
                var Key = WinJS.Utilities.Key;

                // Class Names            
                var appBarClass = "win-appbar",
                    reducedClass = "win-reduced",
                    settingsFlyoutClass = "win-settingsflyout",
                    topClass = "win-top",
                    bottomClass = "win-bottom",
                    closingClass = "win-hiding",
                    closedClass = "win-hidden";

                var firstDivClass = "win-firstdiv",
                    finalDivClass = "win-finaldiv",
                    ellipsisClass = "win-ellipsis";

                // Constants for placement
                var appBarPlacementTop = "top",
                    appBarPlacementBottom = "bottom";

                // Constants for layout
                var appBarLayoutCustom = "custom",
                    appBarLayoutCommands = "commands";

                // Enum of known constant pixel values for display modes. 
                var knownVisibleHeights = {
                    disabled: 0,
                    none: 0,
                    hidden: 0,
                    minimal: 25,
                }

                // Maps each notion of a display modes to the corresponding visible position
                var displayModeVisiblePositions = {
                    disabled: "hidden",
                    none: "hidden",
                    hidden: "hidden",
                    minimal: "minimal",
                    open: "open",
                }

                // Enum of closedDisplayMode constants 
                var closedDisplayModes = {
                    none: "none",
                    minimal: "minimal",
                }

                // Constants open/closed states
                var appbarOpenedState = "opened",
                    appbarClosedState = "closed";

                // Constants for AppBarCommands
                var typeSeparator = "separator",
                    typeContent = "content";

                // Hook into event
                var appBarCommandEvent = false;
                var edgyHappening = null;

                // Handler for the edgy starting/completed/cancelled events
                function _completedEdgy(e) {
                    // If we had a right click on a flyout, ignore it.
                    if (thisWinUI._Overlay._rightMouseMightEdgy &&
                        e.kind === Windows.UI.Input.EdgeGestureKind.mouse) {
                        return;
                    }
                    if (edgyHappening) {
                        // Edgy was happening, just skip it
                        edgyHappening = null;
                    } else {
                        // Edgy wasn't happening, so toggle
                        var keyboardInvoked = e.kind === Windows.UI.Input.EdgeGestureKind.keyboard;
                        WinJS.UI.AppBar._toggleAppBarEdgy(keyboardInvoked);
                    }
                }

                function _startingEdgy() {
                    if (!edgyHappening) {
                        // Edgy wasn't happening, so toggle & start it
                        edgyHappening = WinJS.UI.AppBar._toggleAppBarEdgy(false);
                    }
                }

                function _canceledEdgy() {
                    // Shouldn't get here unless edgy was happening.
                    // Undo whatever we were doing.
                    var bars = _getDynamicBarsForEdgy();
                    if (edgyHappening === "opening") {
                        _closeAllBars(bars, false);
                    } else if (edgyHappening === "closing") {
                        _showAllBars(bars, false);
                    }
                    edgyHappening = null;
                }

                function _allManipulationChanged(event) {
                    var elements = document.querySelectorAll("." + appBarClass);
                    if (elements) {
                        var len = elements.length;
                        for (var i = 0; i < len; i++) {
                            var element = elements[i];
                            var appbar = element.winControl;
                            if (appbar && !element.disabled) {
                                appbar._manipulationChanged(event);
                            }
                        }
                    }
                }

                // Get all the non-sticky bars and return them.
                // Returns array of AppBar objects.
                // The array also has _closed and/or _opened set if ANY are closed or opened.
                function _getDynamicBarsForEdgy() {
                    var elements = document.querySelectorAll("." + appBarClass);
                    var len = elements.length;
                    var AppBars = [];
                    AppBars._opened = false;
                    AppBars._closed = false;
                    for (var i = 0; i < len; i++) {
                        var element = elements[i];
                        if (element.disabled) {
                            // Skip disabled AppBars
                            continue;
                        }
                        var AppBar = element.winControl;
                        if (AppBar) {
                            AppBars.push(AppBar);
                            if (AppBar._closed) {
                                AppBars.closed = true;
                            } else {
                                AppBars._opened = true;
                            }
                        }
                    }

                    return AppBars;
                }

                // open or close all bars
                function _closeAllBars(bars, keyboardInvoked) {
                    var len = bars.length;
                    var allBarsAnimationPromises = new Array(len);
                    for (var i = 0; i < len; i++) {
                        bars[i]._keyboardInvoked = keyboardInvoked;
                        bars[i].hide();
                        allBarsAnimationPromises[i] = bars[i]._animationPromise;
                    }
                    return WinJS.Promise.join(allBarsAnimationPromises);
                }

                function _openAllBars(bars, keyboardInvoked) {
                    var len = bars.length;
                    var allBarsAnimationPromises = new Array(len);
                    for (var i = 0; i < len; i++) {
                        bars[i]._keyboardInvoked = keyboardInvoked;
                        bars[i]._doNotFocus = false;
                        bars[i]._open();
                        allBarsAnimationPromises[i] = bars[i]._animationPromise;
                    }
                    return WinJS.Promise.join(allBarsAnimationPromises);
                }

                // Sets focus to the last AppBar in the provided appBars array with given placement.
                // Returns true if focus was set.  False otherwise.
                function _setFocusToPreviousAppBarHelper(startIndex, appBarPlacement, appBars) {
                    for (var i = startIndex; i >= 0; i--) {
                        if (appBars[i].winControl
                         && appBars[i].winControl.placement === appBarPlacement
                         && !appBars[i].winControl.hidden
                         && appBars[i].winControl._focusOnLastFocusableElement
                         && appBars[i].winControl._focusOnLastFocusableElement()) {
                            return true;
                        }
                    }
                    return false;
                }

                // Sets focus to the last AppBar in the provided appBars array with other placement.
                // Returns true if focus was set.  False otherwise.
                function _setFocusToPreviousAppBarHelperNeither(startIndex, appBars) {
                    for (var i = startIndex; i >= 0; i--) {
                        if (appBars[i].winControl
                         && appBars[i].winControl.placement != appBarPlacementBottom
                         && appBars[i].winControl.placement != appBarPlacementTop
                         && !appBars[i].winControl.hidden
                         && appBars[i].winControl._focusOnLastFocusableElement
                         && appBars[i].winControl._focusOnLastFocusableElement()) {
                            return true;
                        }
                    }
                    return false;
                }

                // Sets focus to the last tab stop of the previous AppBar
                // AppBar tabbing order:
                //    1) Bottom AppBars
                //    2) Top AppBars
                //    3) Other AppBars
                // DOM order is respected, because an AppBar should not have a defined tabIndex
                function _setFocusToPreviousAppBar() {
                    var appBars = document.querySelectorAll("." + appBarClass);
                    if (!appBars.length) {
                        return;
                    }

                    var thisAppBarIndex = 0;
                    for (var i = 0; i < appBars.length; i++) {
                        if (appBars[i] === this.parentElement) {
                            thisAppBarIndex = i;
                            break;
                        }
                    }

                    var appBarControl = this.parentElement.winControl;
                    if (appBarControl.placement === appBarPlacementBottom) {
                        // Bottom appBar: Focus order: (1)previous bottom appBars (2)other appBars (3)top appBars (4)bottom appBars
                        if (thisAppBarIndex && _setFocusToPreviousAppBarHelper(thisAppBarIndex - 1, appBarPlacementBottom, appBars)) { return; }
                        if (_setFocusToPreviousAppBarHelperNeither(appBars.length - 1, appBars)) { return; }
                        if (_setFocusToPreviousAppBarHelper(appBars.length - 1, appBarPlacementTop, appBars)) { return; }
                        if (_setFocusToPreviousAppBarHelper(appBars.length - 1, appBarPlacementBottom, appBars)) { return; }
                    } else if (appBarControl.placement === appBarPlacementTop) {
                        // Top appBar: Focus order: (1)previous top appBars (2)bottom appBars (3)other appBars (4)top appBars
                        if (thisAppBarIndex && _setFocusToPreviousAppBarHelper(thisAppBarIndex - 1, appBarPlacementTop, appBars)) { return; }
                        if (_setFocusToPreviousAppBarHelper(appBars.length - 1, appBarPlacementBottom, appBars)) { return; }
                        if (_setFocusToPreviousAppBarHelperNeither(appBars.length - 1, appBars)) { return; }
                        if (_setFocusToPreviousAppBarHelper(appBars.length - 1, appBarPlacementTop, appBars)) { return; }
                    } else {
                        // Other appBar: Focus order: (1)previous other appBars (2)top appBars (3)bottom appBars (4)other appBars
                        if (thisAppBarIndex && _setFocusToPreviousAppBarHelperNeither(thisAppBarIndex - 1, appBars)) { return; }
                        if (_setFocusToPreviousAppBarHelper(appBars.length - 1, appBarPlacementTop, appBars)) { return; }
                        if (_setFocusToPreviousAppBarHelper(appBars.length - 1, appBarPlacementBottom, appBars)) { return; }
                        if (_setFocusToPreviousAppBarHelperNeither(appBars.length - 1, appBars)) { return; }
                    }
                }

                // Sets focus to the first AppBar in the provided appBars array with given placement.
                // Returns true if focus was set.  False otherwise.
                function _setFocusToNextAppBarHelper(startIndex, appBarPlacement, appBars) {
                    for (var i = startIndex; i < appBars.length; i++) {
                        if (appBars[i].winControl
                         && appBars[i].winControl.placement === appBarPlacement
                         && !appBars[i].winControl.hidden
                         && appBars[i].winControl._focusOnFirstFocusableElement
                         && appBars[i].winControl._focusOnFirstFocusableElement()) {
                            return true;
                        }
                    }
                    return false;
                }

                // Sets focus to the first AppBar in the provided appBars array with other placement.
                // Returns true if focus was set.  False otherwise.
                function _setFocusToNextAppBarHelperNeither(startIndex, appBars) {
                    for (var i = startIndex; i < appBars.length; i++) {
                        if (appBars[i].winControl
                         && appBars[i].winControl.placement != appBarPlacementBottom
                         && appBars[i].winControl.placement != appBarPlacementTop
                         && !appBars[i].winControl.hidden
                         && appBars[i].winControl._focusOnFirstFocusableElement
                         && appBars[i].winControl._focusOnFirstFocusableElement()) {
                            return true;
                        }
                    }
                    return false;
                }

                // Sets focus to the first tab stop of the next AppBar
                // AppBar tabbing order:
                //    1) Bottom AppBars
                //    2) Top AppBars
                //    3) Other AppBars
                // DOM order is respected, because an AppBar should not have a defined tabIndex
                function _setFocusToNextAppBar() {
                    var appBars = document.querySelectorAll("." + appBarClass);

                    var thisAppBarIndex = 0;
                    for (var i = 0; i < appBars.length; i++) {
                        if (appBars[i] === this.parentElement) {
                            thisAppBarIndex = i;
                            break;
                        }
                    }

                    var appBarControl = this.parentElement.winControl;
                    if (this.parentElement.winControl.placement === appBarPlacementBottom) {
                        // Bottom appBar: Focus order: (1)next bottom appBars (2)top appBars (3)other appBars (4)bottom appBars
                        if (_setFocusToNextAppBarHelper(thisAppBarIndex + 1, appBarPlacementBottom, appBars)) { return; }
                        if (_setFocusToNextAppBarHelper(0, appBarPlacementTop, appBars)) { return; }
                        if (_setFocusToNextAppBarHelperNeither(0, appBars)) { return; }
                        if (_setFocusToNextAppBarHelper(0, appBarPlacementBottom, appBars)) { return; }
                    } else if (this.parentElement.winControl.placement === appBarPlacementTop) {
                        // Top appBar: Focus order: (1)next top appBars (2)other appBars (3)bottom appBars (4)top appBars
                        if (_setFocusToNextAppBarHelper(thisAppBarIndex + 1, appBarPlacementTop, appBars)) { return; }
                        if (_setFocusToNextAppBarHelperNeither(0, appBars)) { return; }
                        if (_setFocusToNextAppBarHelper(0, appBarPlacementBottom, appBars)) { return; }
                        if (_setFocusToNextAppBarHelper(0, appBarPlacementTop, appBars)) { return; }
                    } else {
                        // Other appBar: Focus order: (1)next other appBars (2)bottom appBars (3)top appBars (4)other appBars
                        if (_setFocusToNextAppBarHelperNeither(thisAppBarIndex + 1, appBars)) { return; }
                        if (_setFocusToNextAppBarHelper(0, appBarPlacementBottom, appBars)) { return; }
                        if (_setFocusToNextAppBarHelper(0, appBarPlacementTop, appBars)) { return; }
                        if (_setFocusToNextAppBarHelperNeither(0, appBars)) { return; }
                    }
                }

                // Updates the firstDiv & finalDiv of all open AppBars
                function _updateAllAppBarsFirstAndFinalDiv() {
                    var appBars = document.querySelectorAll("." + appBarClass);

                    for (var i = 0; i < appBars.length; i++) {
                        if (appBars[i].winControl
                         && !appBars[i].winControl.hidden
                         && appBars[i].winControl._updateFirstAndFinalDiv) {
                            appBars[i].winControl._updateFirstAndFinalDiv();
                        }
                    }
                }

                // Returns true if an open non-sticky (light dismiss) AppBar is found in the document
                function _isThereOpenNonStickyBar() {
                    var appBars = document.querySelectorAll("." + appBarClass);
                    for (var i = 0; i < appBars.length; i++) {
                        var appBarControl = appBars[i].winControl;
                        if (appBarControl && !appBarControl.sticky &&
                            (!appBarControl.hidden || appBarControl._element.winAnimating === "open")) {
                            return true;
                        }
                    }

                    return false;
                }

                // Close all light dismiss AppBars if what has focus is not part of a AppBar or flyout.
                function _closeIfAllAppBarsLostFocus() {
                    if (!thisWinUI.AppBar._isAppBarOrChild(document.activeElement)) {
                        thisWinUI.AppBar._closeLightDismissAppBars(null, false);
                        // Ensure that sticky appbars clear cached focus after light dismiss are dismissed, which moved focus.
                        thisWinUI.AppBar._ElementWithFocusPreviousToAppBar = null;
                    }
                }

                // If the previous focus was not a AppBar or CED, store it in the cache
                // (_isAppBarOrChild tests CED for us).
                function _checkStorePreviousFocus(focusEvent) {
                    if (focusEvent.relatedTarget
                     && focusEvent.relatedTarget.focus
                     && !thisWinUI.AppBar._isAppBarOrChild(focusEvent.relatedTarget)) {
                        _storePreviousFocus(focusEvent.relatedTarget);
                    }
                }

                // Cache the previous focus information
                function _storePreviousFocus(element) {
                    if (element) {
                        thisWinUI.AppBar._ElementWithFocusPreviousToAppBar = element;
                    }
                }

                // Try to return focus to what had focus before.
                // If successfully return focus to a textbox, restore the selection too.
                function _restorePreviousFocus() {
                    thisWinUI._Overlay._trySetActive(thisWinUI.AppBar._ElementWithFocusPreviousToAppBar);
                }

                var strings = {
                    get ariaLabel() { return WinJS.Resources._getWinJSString("ui/appBarAriaLabel").value; },
                    get requiresCommands() { return WinJS.Resources._getWinJSString("ui/requiresCommands").value; },
                    get nullCommand() { return WinJS.Resources._getWinJSString("ui/nullCommand").value; },
                    get cannotChangePlacementWhenVisible() { return WinJS.Resources._getWinJSString("ui/cannotChangePlacementWhenVisible").value; },
                    get badLayout() { return WinJS.Resources._getWinJSString("ui/badLayout").value; },
                    get cannotChangeLayoutWhenVisible() { return WinJS.Resources._getWinJSString("ui/cannotChangeLayoutWhenVisible").value; }
                };

                var AppBar = WinJS.Class.derive(WinJS.UI._Overlay, function AppBar_ctor(element, options) {
                    /// <signature helpKeyword="WinJS.UI.AppBar.AppBar">
                    /// <summary locid="WinJS.UI.AppBar.constructor">
                    /// Creates a new AppBar control. 
                    /// </summary>
                    /// <param name="element" type="HTMLElement" domElement="true" locid="WinJS.UI.AppBar.constructor_p:element">
                    /// The DOM element that will host the control.
                    /// </param>
                    /// <param name="options" type="Object" locid="WinJS.UI.AppBar.constructor_p:options">
                    /// The set of properties and values to apply to the new AppBar control.
                    /// </param>
                    /// <returns type="WinJS.UI.AppBar" locid="WinJS.UI.AppBar.constructor_returnValue">
                    /// The new AppBar control.
                    /// </returns>
                    /// </signature>

                    this._initializing = true;

                    // Simplify checking later
                    options = options || {};

                    // Make sure there's an element            
                    this._element = element || document.createElement("div");
                    this._id = this._element.id || WinJS.Utilities._uniqueID(this._element);
                    this._writeProfilerMark("constructor,StartTM");

                    if (!this._element.hasAttribute("tabIndex")) {
                        this._element.tabIndex = -1;
                    }

                    // Attach our css class.
                    WinJS.Utilities.addClass(this._element, appBarClass);

                    // Make sure we have an ARIA role
                    var role = this._element.getAttribute("role");
                    if (!role) {
                        this._element.setAttribute("role", "menubar");
                    }
                    var label = this._element.getAttribute("aria-label");
                    if (!label) {
                        this._element.setAttribute("aria-label", strings.ariaLabel);
                    }

                    // Start off completely closed
                    this._lastPositionVisited = displayModeVisiblePositions.none;
                    WinJS.Utilities.addClass(this._element, closedClass);

                    // validate that if they didn't set commands, but want command
                    // layout that the HTML only contains commands.  Do this first
                    // so that we don't leave partial AppBars in the DOM.
                    if (options.layout !== appBarLayoutCustom && !options.commands && this._element) {
                        // Shallow copy object so we can modify it.
                        options = WinJS.Utilities._shallowCopy(options);
                        options.commands = this._verifyCommandsOnly(this._element, "WinJS.UI.AppBarCommand");
                    }

                    // Add Open/Close button.
                    this._ellipsis = document.createElement("BUTTON");
                    this._ellipsis.innerHTML = "<span></span>"; 
                    this._ellipsis.addEventListener('click', WinJS.UI.AppBar._toggleAppBarEdgy, false);
                    WinJS.Utilities.addClass(this._ellipsis, ellipsisClass);
                    this._element.appendChild(this._ellipsis);

                    // Run layout setter immediately. We need to know our layout in order to correctly 
                    // position any commands that may be getting set through the constructor. 
                    this.layout = options.layout || appBarLayoutCommands;
                    delete options.layout;

                    // Need to set placement before closedDisplayMode, closedDisplayMode sets our starting position, which is dependant on placement.
                    this.placement = options.placement || appBarPlacementBottom;
                    this.closedDisplayMode = options.closedDisplayMode || closedDisplayModes.none;

                    // Call the base overlay constructor helper
                    this._baseOverlayConstructor(this._element, options);

                    this._initializing = false;

                    // Make a click eating div
                    thisWinUI._Overlay._createClickEatingDivAppBar();

                    // Handle key down (esc) and (left & right)
                    this._element.addEventListener("keydown", this._handleKeyDown.bind(this), false);

                    // Attach event handler
                    if (!appBarCommandEvent) {
                        // We'll trigger on invoking.  Could also have invoked or canceled
                        // Eventually we may want click up on invoking and drop back on invoked.
                        // Check for namespace so it'll behave in the designer.
                        if (WinJS.Utilities.hasWinRT) {
                            var commandUI = Windows.UI.Input.EdgeGesture.getForCurrentView();
                            commandUI.addEventListener("starting", _startingEdgy);
                            commandUI.addEventListener("completed", _completedEdgy);
                            commandUI.addEventListener("canceled", _canceledEdgy);
                        }

                        // Need to know if the IHM is done scrolling
                        document.addEventListener("MSManipulationStateChanged", _allManipulationChanged, false);

                        appBarCommandEvent = true;
                    }

                    // Make sure _Overlay event handlers are hooked up (this aids light dismiss)
                    this._addOverlayEventHandlers(false);

                    // Need to store what had focus before
                    WinJS.Utilities._addEventListener(this._element, "focusin", function (event) { _checkStorePreviousFocus(event); }, false);

                    // Need to close ourselves if we lose focus
                    WinJS.Utilities._addEventListener(this._element, "focusout", function (event) { _closeIfAllAppBarsLostFocus(); }, false);

                    // Commands layout AppBar measures and caches its content synchronously in setOptions through the .commands property setter.
                    // Remove the commands layout AppBar from the layout tree at this point so we don't cause unnecessary layout costs whenever
                    // the window resizes or when CSS changes are applied to the commands layout AppBar's parent element.
                    if (this.layout === appBarLayoutCommands) {
                        this._element.style.display = "none";
                    }

                    this._writeProfilerMark("constructor,StopTM");

                    return this;
                }, {
                    // Public Properties

                    /// <field type="String" defaultValue="bottom" oamOptionsDatatype="WinJS.UI.AppBar.placement" locid="WinJS.UI.AppBar.placement" helpKeyword="WinJS.UI.AppBar.placement">The placement of the AppBar on the display.  Values are "top" or "bottom".</field>
                    placement: {
                        get: function AppBar_get_placement() {
                            return this._placement;
                        },
                        set: function AppBar_set_placement(value) {
                            // In designer we may have to move it
                            var wasOpen = false;
                            if (window.Windows && Windows.ApplicationModel && Windows.ApplicationModel.DesignMode && Windows.ApplicationModel.DesignMode.designModeEnabled && !this.hidden) {
                                this._close();
                                wasOpen = true;
                            }

                            if (!this.hidden) {
                                throw new WinJS.ErrorFromName("WinJS.UI.AppBar.CannotChangePlacementWhenVisible", strings.cannotChangePlacementWhenVisible);
                            }

                            // Set placement, coerce invalid values to 'bottom'
                            this._placement = (value === appBarPlacementTop) ? appBarPlacementTop : appBarPlacementBottom;

                            // Clean up win-top, win-bottom styles
                            if (this._placement === appBarPlacementTop) {
                                WinJS.Utilities.addClass(this._element, topClass);
                                WinJS.Utilities.removeClass(this._element, bottomClass);
                            } else if (this._placement === appBarPlacementBottom) {
                                WinJS.Utilities.removeClass(this._element, topClass);
                                WinJS.Utilities.addClass(this._element, bottomClass);
                            }

                            // Open again if we closed ourselves for the designer
                            if (wasOpen) {
                                this._open();
                            }
                        }
                    },

                    /// <field type="String" defaultValue="commands" oamOptionsDatatype="WinJS.UI.AppBar.layout" locid="WinJS.UI.AppBar.layout" helpKeyword="WinJS.UI.AppBar.layout">
                    /// Gets or sets the layout of the AppBar contents to either "commands" or "custom".
                    /// </field>
                    layout: {
                        get: function AppBar_get_layout() {
                            return this._layout.type;
                        },
                        set: function AppBar_set_layout(layout) {
                            if (layout !== appBarLayoutCommands && layout !== appBarLayoutCustom) {
                                throw new WinJS.ErrorFromName("WinJS.UI.AppBar.BadLayout", strings.badLayout);
                            }

                            // In designer we may have to redraw it
                            var wasOpen = false;
                            if (window.Windows && Windows.ApplicationModel && Windows.ApplicationModel.DesignMode && Windows.ApplicationModel.DesignMode.designModeEnabled && !this.hidden) {
                                this._close();
                                wasOpen = true;
                            }

                            if (!this.hidden) {
                                throw new WinJS.ErrorFromName("WinJS.UI.AppBar.CannotChangeLayoutWhenVisible", strings.cannotChangeLayoutWhenVisible);
                            }

                            var commands;
                            if (!this._initializing) {
                                // Gather commands in preparation for hand off to new layout.
                                // We expect prev layout to return commands in the order they were set in, 
                                // not necessarily the current DOM order the layout is using.
                                commands = this._layout.commandsInOrder;
                                this._layout.disconnect();
                            }

                            // Set layout
                            if (layout === appBarLayoutCommands) {
                                this._layout = new WinJS.UI._AppBarCommandsLayout();
                            } else {
                                // Custom layout uses Base AppBar Layout class.
                                this._layout = new WinJS.UI._AppBarBaseLayout();
                            }
                            this._layout.connect(this._element);

                            if (commands && commands.length) {
                                // Reset AppBar since layout changed.
                                this._layoutCommands(commands);
                            }
                            this._layout.connect(this._element);

                            if (commands && commands.length) {
                                // Reset AppBar since layout changed.
                                this._layoutCommands(commands);
                            }

                            // Open again if we closed ourselves for the designer
                            if (wasOpen) {
                                this._open();
                            }
                        },
                        configurable: true
                    },

                    /// <field type="Boolean" locid="WinJS.UI.AppBar.sticky" isAdvanced="true" helpKeyword="WinJS.UI.AppBar.sticky">
                    /// Gets or sets value that indicates whether the AppBar is sticky.
                    /// This value is true if the AppBar is sticky; otherwise, it's false.
                    /// </field>
                    sticky: {
                        get: function AppBar_get_sticky() {
                            return this._sticky;
                        },
                        set: function AppBar_set_sticky(value) {
                            // If it doesn't change, do nothing
                            if (this._sticky === !!value) {
                                return;
                            }

                            this._sticky = !!value;

                            // Note: caller still has to call .show() if also want it open.

                            // Show or hide the click eating div based on sticky value
                            if (!this.hidden && this._element.style.visibility === "visible") {
                                // May have changed sticky state for keyboard navigation
                                _updateAllAppBarsFirstAndFinalDiv();

                                // Ensure that the click eating div is in the correct state
                                if (this._sticky) {
                                    if (!_isThereOpenNonStickyBar()) {
                                        thisWinUI._Overlay._hideClickEatingDivAppBar();
                                    }
                                } else {
                                    thisWinUI._Overlay._showClickEatingDivAppBar();

                                    if (this._shouldStealFocus()) {
                                        _storePreviousFocus(document.activeElement);
                                        this._setFocusToAppBar();
                                    }
                                }
                            }
                        }
                    },

                    /// <field type="Array" locid="WinJS.UI.AppBar.commands" helpKeyword="WinJS.UI.AppBar.commands" isAdvanced="true">
                    /// Sets the AppBarCommands in the AppBar. This property accepts an array of AppBarCommand objects.
                    /// </field>
                    commands: {
                        set: function AppBar_set_commands(commands) {
                            // Fail if trying to set when open
                            if (!this.hidden) {
                                throw new WinJS.ErrorFromName("WinJS.UI.AppBar.CannotChangeCommandsWhenVisible", WinJS.Resources._formatString(thisWinUI._Overlay.commonstrings.cannotChangeCommandsWhenVisible, "AppBar"));
                            }

                            // Dispose old commands before tossing them out.
                            if (!this._initializing) {
                                // AppBarCommands defined in markup don't want to be disposed during initialization.
                                this._disposeChildren();
                            }
                            this._layoutCommands(commands);                           
                        }
                    },

                    _layoutCommands: function AppBar_layoutCommands(commands) {
                        // Function precondition: AppBar must already be closed.

                        // Empties AppBar HTML and repopulates with passed in commands.
                        WinJS.Utilities.empty(this._element);
                        this._element.appendChild(this._ellipsis); // Keep our Open/Close button.

                        // In case they had only one command to set...
                        if (!Array.isArray(commands)) {
                            commands = [commands];
                        }

                        this._layout.layout(commands);
                    },

                    /// <field type="String" defaultValue="compact" locid="WinJS.UI.AppBar.commands" helpKeyword="WinJS.UI.AppBar.commands" isAdvanced="true">
                    /// Sets the AppBarCommands in the AppBar. This property accepts an array of AppBarCommand objects.
                    /// </field>
                    closedDisplayMode: {
                        get: function AppBar_get_closedDisplayMode() {
                            return this._closedDisplayMode;
                        },
                        set: function AppBar_set_closedDisplayMode(value) {
                            var oldValue = this._closedDisplayMode;

                            if (value === closedDisplayModes.none) {
                                this._closedDisplayMode = value;
                                this._ellipsis.style.display = "none";
                                this._element.style.padding = "";
                                this._element.style.width = "";
                            } else {
                                // Minimal is default.
                                this._closedDisplayMode = closedDisplayModes.minimal;
                                this._ellipsis.style.display = "";
                                this._element.style.padding = "0px 40px 0px 0px";
                                this._element.style.width = "calc(100% - 40px)";
                            }
                        
                            if (oldValue !== this._closedDisplayMode && this._closed) {
                                // If the value changed while we were closed, update our position.
                                this._changeVisiblePosition(displayModeVisiblePositions[this._closedDisplayMode]);
                            }

                        },
                    },

                    /// <field type="Boolean" locid="WinJS.UI.AppBar.disabled" helpKeyword="WinJS.UI.AppBar.disabled">Disable an AppBar, setting or getting the HTML disabled attribute. When disabled the AppBar will no longer open with show(), and will close, hiding completely if currently opened.</field>
                    disabled: {
                        get: function () {
                            // Ensure it's a boolean because we're using the DOM element to keep in-sync
                            return !!this._element.disabled;
                        },
                        set: function (disable) {
                            var disable = !!disable;
                            if (this.disabled !== disable) {
                                this._element.disabled = disable;
                                var toPosition;
                                if (disable) {
                                    // Disabling. Move to the position mapped to the disabled state.                                                           
                                    toPosition = displayModeVisiblePositions.disabled;
                                } else {
                                    // Enabling. Move to the position mapped to our closedDisplayMode.
                                    toPosition = displayModeVisiblePositions[this.closedDisplayMode];
                                }
                                this._close(toPosition);
                            }
                        },
                    },

                    /// <field type="Boolean" hidden="true" locid="WinJS.UI._AppBar.hidden" helpKeyword="WinJS.UI._AppBar.hidden">Read only, true if an AppBar is 'hidden'.</field>
                    hidden: {
                        get: function () {
                            // Returns true if AppBar is 'closed'. Before the addition of closed display modes, it used to be that hidden was synonymous with closed.
                            // This API is keeping the "hidden" moniker for now to avoid a breaking migration change.
                            return this._closed || this._doNext === displayModeVisiblePositions.minimal || this._doNext === displayModeVisiblePositions.none;
                        },
                    },

                    getCommandById: function (id) {
                        /// <signature helpKeyword="WinJS.UI.AppBar.getCommandById">
                        /// <summary locid="WinJS.UI.AppBar.getCommandById">
                        /// Retrieves the command with the specified ID from this AppBar.
                        /// If more than one command is found, this method returns them all.
                        /// </summary>
                        /// <param name="id" type="String" locid="WinJS.UI.AppBar.getCommandById_p:id">Id of the command to return.</param>
                        /// <returns type="object" locid="WinJS.UI.AppBar.getCommandById_returnValue">
                        /// The command found, an array of commands if more than one have the same ID, or null if no command is found.
                        /// </returns>
                        /// </signature>
                        var commands = this.element.querySelectorAll("#" + id);
                        var newCommands = [];
                        for (var count = 0, len = commands.length; count < len; count++) {
                            if (commands[count].winControl) {
                                newCommands.push(commands[count].winControl);
                            }
                        }

                        if (newCommands.length === 1) {
                            return newCommands[0];
                        } else if (newCommands.length === 0) {
                            return null;
                        }

                        return newCommands;
                    },

                    showCommands: function (commands) {
                        /// <signature helpKeyword="WinJS.UI.AppBar.showCommands">
                        /// <summary locid="WinJS.UI.AppBar.showCommands">
                        /// Show the specified commands of the AppBar.
                        /// </summary>
                        /// <param name="commands" type="Array" locid="WinJS.UI.AppBar.showCommands_p:commands">
                        /// An array of the commands to show. The array elements may be AppBarCommand objects, or the string identifiers (IDs) of commands.
                        /// </param>
                        /// </signature>
                        if (!commands) {
                            throw new WinJS.ErrorFromName("WinJS.UI.AppBar.RequiresCommands", strings.requiresCommands);
                        }

                        this._showCommands(commands);
                    },

                    hideCommands: function (commands) {
                        /// <signature helpKeyword="WinJS.UI.AppBar.hideCommands">
                        /// <summary locid="WinJS.UI.AppBar.hideCommands">
                        /// Hides the specified commands of the AppBar.
                        /// </summary>
                        /// <param name="commands" type="Array" locid="WinJS.UI.AppBar.hideCommands_p:commands">Required. Command or Commands to hide, either String, DOM elements, or WinJS objects.</param>
                        /// </signature>
                        if (!commands) {
                            throw new WinJS.ErrorFromName("WinJS.UI.AppBar.RequiresCommands", strings.requiresCommands);
                        }

                        this._hideCommands(commands);
                    },

                    showOnlyCommands: function (commands) {
                        /// <signature helpKeyword="WinJS.UI.AppBar.showOnlyCommands">
                        /// <summary locid="WinJS.UI.AppBar.showOnlyCommands">
                        /// Show the specified commands, hiding all of the others in the AppBar.
                        /// </summary>
                        /// <param name="commands" type="Array" locid="WinJS.UI.AppBar.showOnlyCommands_p:commands">
                        /// An array of the commands to show. The array elements may be AppBarCommand objects, or the string identifiers (IDs) of commands.
                        /// </param>
                        /// </signature>
                        if (!commands) {
                            throw new WinJS.ErrorFromName("WinJS.UI.AppBar.RequiresCommands", strings.requiresCommands);
                        }

                        this._showOnlyCommands(commands);
                    },

                    show: function () {
                        /// <signature helpKeyword="WinJS.UI.AppBar.show">
                        /// <summary locid="WinJS.UI.AppBar.show">
                        /// Opens the AppBar, if closed, regardless of other state.
                        /// </summary>
                        /// </signature>
                        // Just wrap the private one, turning off keyboard invoked flag
                        this._writeProfilerMark("show,StartTM");
                        this._keyboardInvoked = false;
                        this._doNotFocus = !!this.sticky;
                        this._open();
                    },

                    _open: function AppBar_open() {

                        var toPosition = displayModeVisiblePositions.open;
                        var opening = !this.disabled && this._closed && appbarOpenedState;

                        // If we're already opened, we just want to animate our position, not fire events or manage focus.
                        this._changeVisiblePosition(toPosition, opening);
                        if (opening) {
                            // Configure open state for lightdismiss & sticky appbars.
                            if (!this.sticky) {
                                // Need click-eating div to be visible ASAP.
                                thisWinUI._Overlay._showClickEatingDivAppBar();
                            }

                            // Clean up tabbing behavior by making sure first and final divs are correct after opening.
                            if (!this.sticky && _isThereOpenNonStickyBar()) {
                                _updateAllAppBarsFirstAndFinalDiv();
                            } else {
                                this._updateFirstAndFinalDiv();
                            }

                            // Check if we should steal focus
                            if (!this._doNotFocus && this._shouldStealFocus()) {
                                // Store what had focus if nothing currently is stored
                                if (!thisWinUI.AppBar._ElementWithFocusPreviousToAppBar) {
                                    _storePreviousFocus(document.activeElement);
                                }

                                this._setFocusToAppBar();
                            }
                        }
                    },

                    hide: function () {
                        /// <signature helpKeyword="WinJS.UI.AppBar.hide">
                        /// <summary locid="WinJS.UI.AppBar.hide">
                        /// Closes the AppBar.
                        /// </summary>
                        /// </signature>
                        // Just wrap the private one
                        this._writeProfilerMark("hide,StartTM");
                        this._close();
                    },

                    _close: function AppBar_close(toPosition) {

                        var toPosition = toPosition || displayModeVisiblePositions[this.closedDisplayMode];
                        var closing = !this._closed && appbarClosedState;

                        // If were already closed, we just want to animate our position, not fire events or manage focus again.
                        this._changeVisiblePosition(toPosition, closing);
                        if (closing) {
                            // Determine if there are any AppBars that are Open.
                            // Set the focus to the next Open AppBar.
                            // If there are none, set the focus to the control stored in the cache, which
                            //   is what had focus before the AppBars were given focus.
                            var appBars = document.querySelectorAll("." + appBarClass);
                            var areOtherAppBars = false;
                            var areOtherNonStickyAppBars = false;
                            var i;
                            for (i = 0; i < appBars.length; i++) {
                                var appBarControl = appBars[i].winControl;
                                if (appBarControl && !appBarControl.hidden && (appBarControl !== this)) {
                                    areOtherAppBars = true;

                                    if (!appBarControl.sticky) {
                                        areOtherNonStickyAppBars = true;
                                        break;
                                    }
                                }
                            }

                            var settingsFlyouts = document.querySelectorAll("." + settingsFlyoutClass);
                            var areVisibleSettingsFlyouts = false;
                            for (i = 0; i < settingsFlyouts.length; i++) {
                                var settingsFlyoutControl = settingsFlyouts[i].winControl;
                                if (settingsFlyoutControl && !settingsFlyoutControl.hidden) {
                                    areVisibleSettingsFlyouts = true;
                                    break;
                                }
                            }

                            if (!areOtherNonStickyAppBars && !areVisibleSettingsFlyouts) {
                                // Hide the click eating div because there are no other AppBars open
                                thisWinUI._Overlay._hideClickEatingDivAppBar();
                            }

                            var that = this;
                            if (!areOtherAppBars) {
                                // Set focus to what had focus before the AppBar was opened.
                                if (thisWinUI.AppBar._ElementWithFocusPreviousToAppBar &&
                                    (!document.activeElement || thisWinUI.AppBar._isAppBarOrChild(document.activeElement))) {
                                    _restorePreviousFocus();
                                }
                                // Always clear the previous focus (to prevent temporary leaking of element)
                                thisWinUI.AppBar._ElementWithFocusPreviousToAppBar = null;
                            } else if (thisWinUI.AppBar._isWithinAppBarOrChild(document.activeElement, that.element)) {
                                // Set focus to next open AppBar in DOM

                                var foundCurrentAppBar = false;
                                for (i = 0; i <= appBars.length; i++) {
                                    if (i === appBars.length) {
                                        i = 0;
                                    }

                                    var appBar = appBars[i];
                                    if (appBar === this.element) {
                                        foundCurrentAppBar = true;
                                    } else if (foundCurrentAppBar && !appBar.winControl.hidden) {
                                        appBar.winControl._keyboardInvoked = !!this._keyboardInvoked;
                                        appBar.winControl._setFocusToAppBar();
                                        break;
                                    }
                                }
                            }

                            // If we are closing the last lightDismiss AppBar, 
                            //   then we need to update the tabStops of the other AppBars
                            if (!this.sticky && !_isThereOpenNonStickyBar()) {
                                _updateAllAppBarsFirstAndFinalDiv();
                            }

                            // Reset these values
                            this._keyboardInvoked = false;
                            this._doNotFocus = false;
                        }
                    },

                    _dispose: function AppBar_dispose() {
                        WinJS.Utilities.disposeSubTree(this.element);
                        this._layout.dispose();
                        this.disabled = true;

                    },

                    _disposeChildren: function AppBar_disposeChildren() {
                        // Be purposeful about what we dispose.
                        this._layout.disposeChildren();
                    },

                    _handleKeyDown: function AppBar_handleKeyDown(event) {
                        // On Left/Right arrow keys, moves focus to previous/next AppbarCommand element.
                        // On "Esc" key press hide flyouts and close light dismiss AppBars.

                        // Esc closes light-dismiss AppBars in all layouts but if the user has a text box with an IME 
                        // candidate window open, we want to skip the ESC key event since it is handled by the IME.
                        // When the IME handles a key it sets event.keyCode === Key.IME for an easy check.
                        if (event.keyCode === Key.escape && event.keyCode !== Key.IME) {
                            event.preventDefault();
                            event.stopPropagation();
                            thisWinUI._Overlay._hideAllFlyouts();
                            thisWinUI.AppBar._closeLightDismissAppBars(null, true);
                        }

                        // Layout might want to handle additional keys
                        this._layout.handleKeyDown(event);
                    },
                    _visiblePixels: {
                        get: function () {
                            // Returns object containing pixel height of each visible position
                            return {
                                hidden: knownVisibleHeights.hidden,
                                minimal: knownVisibleHeights.minimal,
                                // Element can change size as content gets added or removed or if it 
                                // experinces style changes. We have to look this up at run time.      
                                open: this._element.offsetHeight,
                            }
                        }
                    },
                    _visiblePosition: {
                        // Returns string value of our nearest, stationary, visible position.
                        get: function () {
                            // If we're we're performing an animation that is a position change,  return that position.  
                            if (this._animating && displayModeVisiblePositions[this._element.winAnimating]) {
                                return this._element.winAnimating;
                            } else {
                                return this._lastPositionVisited;
                            }
                        }
                    },

                    _closed: {
                        get: function () {
                            return (this._visiblePosition !== displayModeVisiblePositions.open);
                        }
                    },
                    _changeVisiblePosition: function (toPosition, newState) {
                        // Change the visible position of our AppBar.
                        // FIRST PARAMETER: 'toPosition' is the string value of the visible position we want to move to.
                        // SECOND PARAMETER: 'newState' is a string value of the new state we are entering (opened/closed). 
                        //   If the value is null, then we are not changing states, only changing visible positions.
                        // RETURN VALUE: This function returns true if the requested position change was successful, else returns false.
                        
                        if (this._visiblePosition === toPosition || (this.disabled && toPosition !== displayModeVisiblePositions.disabled)) {
                            // If we want to go where we already are, or we're disabled return false.                    
                            return false;
                        } else if (this._animating || this._needToHandleShowingKeyboard || this._needToHandleHidingKeyboard) {
                            // Only do one thing at a time. If we are already animating, 
                            // or the IHM is animating, schedule this for later.
                            this._doNext = toPosition;
                            return false;
                        } else {
                            // Begin position changing sequence.

                            //Set the animating flag to block any queued position changes until we're done.
                            this._element.winAnimating = toPosition;
                            var performAnimation = this._initializing ? false : true;

                            // Assume we are animating from the last position visited.
                            var fromPosition = this._lastPositionVisited;

                            // We'll need to measure our element to determine how far we need to animate. 
                            // Make sure we have dimensions.
                            this._element.style.display = "";

                            // Are we hiding completely, or about to become visible?
                            var hidingCompletely = (toPosition === displayModeVisiblePositions.hidden);

                            if (this._keyboardObscured) {
                                // We're changing position while covered by the IHM.                        
                                if (hidingCompletely) {
                                    // If we're covered by the IHM we already look hidden. 
                                    // We can skip our animation and just close.
                                    performAnimation = false;
                                } else {
                                    // Some portion of the AppBar should be visible to users after its position changes.

                                    // Un-obscure ourselves and become visible to the user again. 
                                    // Need to animate to our desired position as if we were coming up from behind the keyboard.
                                    fromPosition = displayModeVisiblePositions.hidden;
                                    this._keyboardObscured = false;
                                }
                            }

                            // Fire "before" event if we are changing state.
                            if (newState === appbarOpenedState) {
                                this._beforeOpen();
                            } else if (newState === appbarClosedState) {
                                this._beforeClose();
                            }
                            // Define body of work to perform after changing positions. 
                            // Bind it to ourselves.
                            var afterPositionChange = function _afterPosiitonChange(newPosition) {
                                if (this._disposed) {
                                    return;
                                }
                                // Clear animation flag and record having visited this position.
                                this._element.winAnimating = "";
                                this._lastPositionVisited = newPosition;

                                if (hidingCompletely) {
                                    // Make sure animation is finished.
                                    this._element.style.visibility = "hidden";
                                    this._element.style.display = "none";
                                }

                                if (this._doNext === this._lastPositionVisited) {
                                    this._doNext = "";
                                }

                                // Fire "after" event if we changed state.
                                if (newState === appbarOpenedState) {
                                    this._afterOpen();
                                } else if (newState === appbarClosedState) {
                                    this._afterClose();
                                }

                                // If we had something queued, do that
                                WinJS.Utilities.Scheduler.schedule(this._checkDoNext, WinJS.Utilities.Scheduler.Priority.normal, this, "WinJS.UI._Overlay._checkDoNext");
                            }.bind(this);

                            // Position our element into the correct "end of animation" position, 
                            // also accounting for any viewport scrolling or soft keyboard positioning.                
                            this._ensurePosition();

                            this._animationPromise = (performAnimation) ? this._animatePositionChange(fromPosition, toPosition) : WinJS.Promise.wrap();
                            this._animationPromise.then(
                                function () { afterPositionChange(toPosition) },
                                function () { afterPositionChange(toPosition) }
                                );
                            return true;
                        }
                    },

                    _beforeOpen: function AppBar_beforeOpen() {
                        // Each overlay tracks the window width for triggering light-dismiss in the resize handler.
                        this._currentDocumentWidth = this._currentDocumentWidth || document.documentElement.offsetWidth;

                        // In case their event 'beforeshow' event listener is going to manipulate commands, 
                        // first see if there are any queued command animations we can handle while we're still closed.
                        if (this._queuedCommandAnimation) {
                            this._showAndHideFast(this._queuedToShow, this._queuedToHide);
                            this._queuedToShow = [];
                            this._queuedToHide = [];
                        }

                        // Make sure everything fits before opening
                        this._layout.scale();

                        this._ellipsis.style.width = "";
                        WinJS.Utilities.removeClass(this._element, closedClass);

                        // Send our "beforeShow" event 
                        this._sendEvent(WinJS.UI._Overlay.beforeShow);
                    },

                    _afterOpen: function AppBar_afterOpen() {
                        // Send our "afterShow" event
                        this._sendEvent(WinJS.UI._Overlay.afterShow);
                        this._writeProfilerMark("show,StopTM");
                    },

                    _beforeClose: function AppBar_beforeClose() {                      

                        // Send our "beforeHide" event
                        this._sendEvent(WinJS.UI._Overlay.beforeHide);

                        WinJS.Utilities.addClass(this._element, closingClass);
                        this._ellipsis.style.width = "100%";
                    },

                    _afterClose: function AppBar_afterClose() {

                        // In case their 'afterhide' event handler is going to manipulate commands, 
                        // first see if there are any queued command animations we can handle now we're closed.
                        if (this._queuedCommandAnimation) {
                            this._showAndHideFast(this._queuedToShow, this._queuedToHide);
                            this._queuedToShow = [];
                            this._queuedToHide = [];
                        }

                        WinJS.Utilities.addClass(this._element, closedClass);
                        WinJS.Utilities.removeClass(this._element, closingClass);

                        // Send our "afterHide" event
                        this._sendEvent(WinJS.UI._Overlay.afterHide);
                        this._writeProfilerMark("hide,StopTM");
                    },


                    _animatePositionChange: function AppBar_animatePositionChange(fromPosition, toPosition) {
                        // Determines and executes the proper transition between visible positions

                        // Get values in terms of pixels to perform animation.
                        var beginningOffset,
                            startingHeight = this._visiblePixels[fromPosition],
                            endingHeight = this._visiblePixels[toPosition],
                            distanceToMove = endingHeight - startingHeight;

                        // Get animation direction and clear other value
                        if (this._placement === appBarPlacementTop) {
                            // Top Bar
                            beginningOffset = { top: -distanceToMove + "px", left: "0px" };
                        } else {
                            // Bottom Bar
                            beginningOffset = { top: distanceToMove + "px", left: "0px" };
                        }

                        // Animate
                        this._element.style.opacity = 1;
                        this._element.style.visibility = "visible";
                        return WinJS.UI.Animation.showEdgeUI(this._element, beginningOffset, { mechanism: "transition" });
                    },

                    _checkDoNext: function AppBar_checkDoNext() {
                        // Do nothing if we're still animating
                        if (this._animating || this._needToHandleShowingKeyboard || this._needToHandleHidingKeyboard || this._disposed) {
                            return;
                        }

                        if (this._doNext === displayModeVisiblePositions.disabled ||
                            this._doNext === displayModeVisiblePositions.hidden ||
                            this._doNext === displayModeVisiblePositions.minimal) {
                            // Do close first because animating commands would be easier
                            this._close(this._doNext);
                            this._doNext = "";
                        } else if (this._queuedCommandAnimation) {
                            // Do queued commands before opening if possible
                            this._showAndHideQueue();
                        } else if (this._doNext === displayModeVisiblePositions.open) {
                            // Open last so that we don't unnecessarily animate commands
                            this._open();
                            this._doNext = "";
                        }
                    },

                    _isABottomAppBarInTheProcessOfOpening: function AppBar_isABottomAppBarInTheProcessOfOpening() {
                        var appbars = document.querySelectorAll("." + appBarClass + "." + bottomClass);
                        for (var i = 0; i < appbars.length; i++) {
                            if (appbars[i].winAnimating === "open") {
                                return true;
                            }
                        }

                        return false;
                    },

                    // Returns true if
                    //   1) This is a bottom appbar
                    //   2) No appbar has focus and a bottom appbar is not in the process of opening
                    //   3) What currently has focus is neither a bottom appbar nor a top appbar
                    //      AND a bottom appbar is not in the process of opening.
                    // Otherwise Returns false
                    _shouldStealFocus: function AppBar_shouldStealFocus() {
                        var activeElementAppBar = thisWinUI.AppBar._isAppBarOrChild(document.activeElement);
                        if (this._element === activeElementAppBar) {
                            // This appbar already has focus and we don't want to move focus 
                            // from where it currently is in this appbar.
                            return false;
                        }
                        if (this._placement === appBarPlacementBottom) {
                            // This is a bottom appbar
                            return true;
                        }

                        var isBottomAppBarOpening = this._isABottomAppBarInTheProcessOfOpening();
                        if (!activeElementAppBar) {
                            // Currently no appbar has focus.
                            // Return true if a bottom appbar is not in the process of opening.
                            return !isBottomAppBarOpening;
                        }
                        if (!activeElementAppBar.winControl) {
                            // This should not happen, but if it does we want to make sure
                            // that an AppBar ends up with focus.
                            return true;
                        }
                        if ((activeElementAppBar.winControl._placement !== appBarPlacementBottom)
                         && (activeElementAppBar.winControl._placement !== appBarPlacementTop)
                             && !isBottomAppBarOpening) {
                            // What currently has focus is neither a bottom appbar nor a top appbar
                            // -and-
                            // a bottom appbar is not in the process of opening.
                            return true;
                        }
                        return false
                    },

                    // Set focus to the passed in AppBar
                    _setFocusToAppBar: function AppBar_setFocusToAppBar() {
                        if (this._focusOnFirstFocusableElement()) {
                            // Prevent what is gaining focus from showing that it has focus,
                            // but only in the non-keyboard scenario.
                            if (!this._keyboardInvoked) {
                                thisWinUI._Overlay._addHideFocusClass(document.activeElement);
                            }
                        } else {
                            // No first element, set it to appbar itself
                            thisWinUI._Overlay._trySetActive(this._element);
                        }
                    },

                    _commandsUpdated: function AppBar_commandsUpdated() {
                        this._layout.commandsUpdated();
                        this._layout.scale();
                    },

                    _beginAnimateCommands: function AppBar_beginAnimateCommands(showCommands, hideCommands, otherVisibleCommands) {
                        // The parameters are 3 mutually exclusive arrays of win-command elements contained in this Overlay.
                        // 1) showCommands[]: All of the HIDDEN win-command elements that ARE scheduled to show. 
                        // 2) hideCommands[]: All of the VISIBLE win-command elements that ARE scheduled to hide.
                        // 3) otherVisibleCommands[]: All VISIBLE win-command elements that ARE NOT scheduled to hide.                               
                        this._layout.beginAnimateCommands(showCommands, hideCommands, otherVisibleCommands);
                    },

                    _endAnimateCommands: function AppBar_endAnimateCommands() {
                        this._layout.endAnimateCommands();
                    },

                    // Get the top of the top appbars, this is always 0 because appbar uses
                    // -ms-device-fixed positioning.
                    _getTopOfVisualViewport: function AppBar_getTopOfVisualViewPort() {
                        return 0;
                    },

                    // Get the bottom of the bottom appbars, Bottom is just 0, if there's no IHM.
                    // When the IHM appears, the default behavior is to resize the view. If a resize
                    // happens, we can rely on -ms-device-fixed positioning and leave the bottom
                    // at 0. However if resize doesn't happen, then the keyboard obscures the appbar
                    // and we will need to adjust the bottom of the appbar by distance of the keyboard.
                    _getAdjustedBottom: function AppBar_getAdjustedBottom() {
                        // Need the distance the IHM moved as well.
                        return thisWinUI._Overlay._keyboardInfo._visibleDocBottomOffset;
                    },

                    _showingKeyboard: function AppBar_showingKeyboard(event) {
                        // Remember keyboard showing state.
                        this._keyboardObscured = false;
                        this._needToHandleHidingKeyboard = false;

                        // If we're already moved, then ignore the whole thing
                        if (thisWinUI._Overlay._keyboardInfo._visible && this._alreadyInPlace()) {
                            return;
                        }

                        this._needToHandleShowingKeyboard = true;
                        // If focus is in the appbar, don't cause scrolling.
                        if (!this.hidden && this._element.contains(document.activeElement)) {
                            event.ensuredFocusedElementInView = true;
                        }

                        // Check if appbar moves or if we're ok leaving it obscured
                        if (!this.hidden && this._placement !== appBarPlacementTop && thisWinUI._Overlay._isFlyoutVisible()) {
                            // Remember that we're obscured
                            this._keyboardObscured = true;
                        } else {
                            // Don't be obscured, clear _scrollHappened flag to give us inference later on when to re-open ourselves.
                            this._scrollHappened = false;
                        }

                        // Also set timeout regardless, so we can clean up our _keyboardShowing flag.
                        var that = this;
                        setTimeout(function (e) { that._checkKeyboardTimer(e); }, thisWinUI._Overlay._keyboardInfo._animationShowLength + thisWinUI._Overlay._scrollTimeout);
                    },

                    _hidingKeyboard: function AppBar_hidingKeyboard(event) {
                        // We won't be obscured
                        this._keyboardObscured = false;
                        this._needToHandleShowingKeyboard = false;
                        this._needToHandleHidingKeyboard = true;

                        // We'll either just reveal the current space or resize the window
                        if (!thisWinUI._Overlay._keyboardInfo._isResized) {
                            // If we're opened or only fake hiding under keyboard, or already animating,
                            // then snap us to our final position.
                            if (!this.hidden || this._fakeHide || this._animating) {
                                // Not resized, update our final position immediately
                                this._checkScrollPosition();
                                this._element.style.display = "";
                                this._fakeHide = false;
                            }
                            this._needToHandleHidingKeyboard = false;
                        }
                        // Else resize should clear keyboardHiding.
                    },

                    _resize: function AppBar_resize(event) {
                        // If we're hidden by the keyboard, then close bottom appbar so it doesn't pop up twice when it scrolls
                        if (this._needToHandleShowingKeyboard) {
                            // Top is allowed to scroll off the top, but we don't want bottom to peek up when
                            // scrolled into view since we'll re-open it ourselves and don't want a stutter effect.
                            if (!this.hidden) {
                                if (this._placement !== appBarPlacementTop && !this._keyboardObscured) {
                                    // If viewport doesn't match window, need to vanish momentarily so it doesn't scroll into view,
                                    // however we don't want to toggle the visibility="hidden" hidden flag.
                                    this._element.style.display = "none";
                                }
                            }
                            // else if we're top we stay, and if there's a flyout, stay obscured by the keyboard.
                        } else if (this._needToHandleHidingKeyboard) {
                            this._needToHandleHidingKeyboard = false;
                            if (!this.hidden || this._animating) {
                                // Snap to final position
                                this._checkScrollPosition();
                                this._element.style.display = "";
                                this._fakeHide = false;
                            }
                        }

                        // Make sure everything still fits.
                        this._layout.resize(event);
                    },

                    _checkKeyboardTimer: function AppBar_checkKeyboardTimer() {
                        if (!this._scrollHappened) {
                            this._mayEdgeBackIn();
                        }
                    },

                    _manipulationChanged: function AppBar_manipulationChanged(event) {
                        // See if we're at the not manipulating state, and we had a scroll happen,
                        // which is implicitly after the keyboard animated.
                        if (event.currentState === 0 && this._scrollHappened) {
                            this._mayEdgeBackIn();
                        }
                    },

                    _mayEdgeBackIn: function AppBar_mayEdgeBackIn(event) {
                        // May need to react to IHM being resized event
                        if (this._needToHandleShowingKeyboard) {
                            // If not top appbar or viewport isn't still at top, then need to open again
                            this._needToHandleShowingKeyboard = false;
                            // If obscured (flyout showing), don't change.
                            // If hidden, may be because _fakeHide was set in _resize.
                            // If bottom we have to move, or if top scrolled off screen.
                            if (!this._keyboardObscured && (!this.hidden || this._fakeHide) &&
                                (this._placement !== appBarPlacementTop || thisWinUI._Overlay._keyboardInfo._visibleDocTop !== 0)) {
                                this._doNotFocus = true;
                                this._fakeHide = true;
                                this._open();
                            } else {
                                // Ensure any animations dropped during the showing keyboard are caught up.
                                this._checkDoNext();
                            }
                        }
                        this._scrollHappened = false;
                    },

                    _ensurePosition: function AppBar_ensurePosition() {
                        // Position the AppBar element relative to the top or bottom edge of the visible
                        // document, based on the the visible position we think we need to be in.
                        if (this._closed) {
                            var innerEdgeOffSet = WinJS.UI._Overlay._keyboardInfo._visibleDocHeight - this._visiblePixels[this._visiblePosition];

                            if (this._placement === appBarPlacementBottom) {
                                this._element.style.bottom = "auto";
                                this._element.style.top = innerEdgeOffSet + "px";
                            } else {
                                this._element.style.bottom = innerEdgeOffSet + "px";
                                this._element.style.top = "auto";
                            }
                        } else {
                            if (this._placement === appBarPlacementBottom) {
                                // If the IHM is open, the bottom of the visual viewport may or may not be obscured 
                                // Use _getAdjustedBottom to account for the IHM if it is covering the bottom edge.
                                this._element.style.bottom = this._getAdjustedBottom() + "px";
                                this._element.style.top = "auto";
                            } else {
                                this._element.style.bottom = "auto";
                                this._element.style.top = this._getTopOfVisualViewport() + "px";
                            }
                        }
                    },

                    //_ensurePosition: function AppBar_ensurePosition() {
                    //    // Position the AppBar element relative to the top or bottom edge of the visible
                    //    // document, based on the the visible position we think we need to be in.

                    //    // How many pixels offscreen will our visible position require the outer edge of the AppBar to be?
                    //    var offScreenHeight = (this._element.offsetHeight - this._visiblePixels[this._visiblePosition]);

                    //    if (this._placement === appBarPlacementBottom) {
                    //        // If the IHM is open, the bottom of the visual viewport may or may not be obscured 
                    //        // Use _getAdjustedBottom to account for the IHM if it is covering the bottom edge.
                    //        this._element.style.bottom = (this._getAdjustedBottom() - offScreenHeight) + "px";
                    //    } else if (this._placement === appBarPlacementTop) {
                    //        this._element.style.top = this._getTopOfVisualViewport() - offScreenHeight + "px";
                    //    }
                    //    // else we don't touch custom positions
                    //},

                    _checkScrollPosition: function AppBar_checkScrollPosition(event) {
                        // If IHM has appeared, then remember we may come in
                        if (this._needToHandleShowingKeyboard) {
                            // Tag that it's OK to edge back in.
                            this._scrollHappened = true;
                            return;
                        }

                        // We only need to update if we're open
                        if (!this.hidden || this._animating) {
                            this._ensurePosition();
                            // Ensure any animations dropped during the showing keyboard are caught up.
                            this._checkDoNext();
                        }
                    },

                    _alreadyInPlace: function AppBar_alreadyInPlace() {
                        // See if we're already where we're supposed to be.
                        if (this._placement === appBarPlacementBottom) {
                            if (parseInt(this._element.style.bottom) === this._getAdjustedBottom()) {
                                return true;
                            }
                        } else if (this._placement === appBarPlacementTop) {
                            if (parseInt(this._element.style.top) === this._getTopOfVisualViewport()) {
                                return true;
                            }
                        }
                        // else we don't understand custom positioning
                        return false;
                    },

                    // If there is an open non-sticky AppBar then it sets the firstDiv tabIndex to
                    //   the minimum tabIndex found in the AppBars and finalDiv to the max found.
                    // Otherwise sets their tabIndex to -1 so they are not tab stops.
                    _updateFirstAndFinalDiv: function AppBar_updateFirstAndFinalDiv() {
                        var appBarFirstDiv = this._element.querySelectorAll("." + firstDivClass);
                        appBarFirstDiv = appBarFirstDiv.length >= 1 ? appBarFirstDiv[0] : null;

                        var appBarFinalDiv = this._element.querySelectorAll("." + finalDivClass);
                        appBarFinalDiv = appBarFinalDiv.length >= 1 ? appBarFinalDiv[0] : null;

                        // Remove the firstDiv & finalDiv if they are not at the appropriate locations
                        if (appBarFirstDiv && (this._element.children[0] !== appBarFirstDiv)) {
                            appBarFirstDiv.parentNode.removeChild(appBarFirstDiv);
                            appBarFirstDiv = null;
                        }
                        if (appBarFinalDiv && (this._element.children[this._element.children.length - 1] !== appBarFinalDiv)) {
                            appBarFinalDiv.parentNode.removeChild(appBarFinalDiv);
                            appBarFinalDiv = null;
                        }

                        // Create and add the firstDiv & finalDiv if they don't already exist
                        if (!appBarFirstDiv) {
                            // Add a firstDiv that will be the first child of the appBar.
                            // On focus set focus to the previous appBar.
                            // The div should only be focusable if there are open non-sticky AppBars.
                            appBarFirstDiv = document.createElement("div");
                            // display: inline is needed so that the div doesn't take up space and cause the page to scroll on focus
                            appBarFirstDiv.style.display = "inline";
                            appBarFirstDiv.className = firstDivClass;
                            appBarFirstDiv.tabIndex = -1;
                            appBarFirstDiv.setAttribute("aria-hidden", "true");
                            WinJS.Utilities._addEventListener(appBarFirstDiv, "focusin", _setFocusToPreviousAppBar, false);
                            // add to beginning
                            if (this._element.children[0]) {
                                this._element.insertBefore(appBarFirstDiv, this._element.children[0]);
                            } else {
                                this._element.appendChild(appBarFirstDiv);
                            }
                        }
                        if (!appBarFinalDiv) {
                            // Add a finalDiv that will be the last child of the appBar.
                            // On focus set focus to the next appBar.
                            // The div should only be focusable if there are open non-sticky AppBars.
                            appBarFinalDiv = document.createElement("div");
                            // display: inline is needed so that the div doesn't take up space and cause the page to scroll on focus
                            appBarFinalDiv.style.display = "inline";
                            appBarFinalDiv.className = finalDivClass;
                            appBarFinalDiv.tabIndex = -1;
                            appBarFinalDiv.setAttribute("aria-hidden", "true");
                            WinJS.Utilities._addEventListener(appBarFinalDiv, "focusin", _setFocusToNextAppBar, false);
                            this._element.appendChild(appBarFinalDiv);
                        }


                        // Ellipsis should be the second to last element in the AppBar's tab order. Second to the finalDiv.
                        if (this._element.children[this._element.children.length - 2] !== this._ellipsis) {
                            this._element.insertBefore(this._ellipsis, appBarFinalDiv);
                        }
                        var elms = this._element.getElementsByTagName("*");
                        var highestTabIndex = WinJS.Utilities._getHighestTabIndexInList(elms);
                        this._ellipsis.tabIndex = highestTabIndex;

                        // Update the tabIndex of the firstDiv & finalDiv
                        if (_isThereOpenNonStickyBar()) {

                            if (appBarFirstDiv) {
                                appBarFirstDiv.tabIndex = WinJS.Utilities._getLowestTabIndexInList(elms);
                            }
                            if (appBarFinalDiv) {
                                appBarFinalDiv.tabIndex = highestTabIndex;
                            }
                        } else {
                            if (appBarFirstDiv) {
                                appBarFirstDiv.tabIndex = -1;
                            }
                            if (appBarFinalDiv) {
                                appBarFinalDiv.tabIndex = -1;
                            }
                        }
                    },

                    _writeProfilerMark: function AppBar_writeProfilerMark(text) {
                        WinJS.Utilities._writeProfilerMark("WinJS.UI.AppBar:" + this._id + ":" + text);
                    }
                });

                // Statics
                AppBar._ElementWithFocusPreviousToAppBar = null;

                // Returns appbar element (or CED/sentinal) if the element or what had focus before the element (if a Flyout) is either:
                //   1) an AppBar,
                //   2) OR in the subtree of an AppBar,
                //   3) OR an AppBar click eating div.
                // Returns null otherwise.
                AppBar._isAppBarOrChild = function (element) {
                    // If it's null, we can't do this
                    if (!element) {
                        return null;
                    }

                    // click eating divs and sentinals should not have children
                    if (WinJS.Utilities.hasClass(element, thisWinUI._Overlay._clickEatingAppBarClass) ||
                        WinJS.Utilities.hasClass(element, thisWinUI._Overlay._clickEatingFlyoutClass) ||
                        WinJS.Utilities.hasClass(element, firstDivClass) ||
                        WinJS.Utilities.hasClass(element, finalDivClass) ||
                        WinJS.Utilities.hasClass(element, ellipsisClass)) {
                        return element;
                    }

                    while (element && element !== document) {
                        if (WinJS.Utilities.hasClass(element, appBarClass)) {
                            return element;
                        }
                        if (WinJS.Utilities.hasClass(element, "win-flyout")
                         && element != element.winControl._previousFocus) {
                            var flyoutControl = element.winControl;
                            // If _previousFocus was in a light dismissable AppBar, then this Flyout is considered of an extension of it and that AppBar will not close.
                            // Hook up a 'focusout' listener to this Flyout element to make sure that light dismiss AppBars close if focus moves anywhere other than back to an AppBar.
                            var appBarElement = thisWinUI.AppBar._isAppBarOrChild(flyoutControl._previousFocus);
                            if (appBarElement) {
                                WinJS.Utilities._addEventListener(flyoutControl.element, 'focusout', function focusOut(event) {
                                    // Closes any open AppBars if the new activeElement is not in an AppBar.
                                    _closeIfAllAppBarsLostFocus();
                                    WinJS.Utilities._removeEventListener(flyoutControl.element, 'focusout', focusOut, false);
                                }, false);
                            }
                            return appBarElement;
                        }

                        element = element.parentNode;
                    }

                    return null;
                };

                // Returns true if the element or what had focus before the element (if a Flyout) is either:
                //   1) the appBar or subtree
                //   2) OR in a flyout spawned by the appBar
                // Returns false otherwise.
                AppBar._isWithinAppBarOrChild = function (element, appBar) {
                    if (!element || !appBar) {
                        return false;
                    }
                    if (appBar.contains(element)) {
                        return true;
                    }
                    var flyout = thisWinUI._Overlay._getParentControlUsingClassName(element, "win-flyout");
                    return (flyout && appBar.contains(flyout._previousFocus));
                };

                // Overlay class calls this for global light dismiss events
                AppBar._closeLightDismissAppBars = function (event, keyboardInvoked) {
                    var elements = document.querySelectorAll("." + appBarClass);
                    var len = elements.length;
                    var AppBars = [];
                    for (var i = 0; i < len; i++) {
                        var AppBar = elements[i].winControl;
                        if (AppBar && !AppBar.sticky && !AppBar.hidden) {
                            AppBars.push(AppBar);
                        }
                    }

                    _closeAllBars(AppBars, keyboardInvoked);
                };

                var appBarSynchronizationPromise = WinJS.Promise.as();

                // Callback for AppBar Edgy Event Command   
                AppBar._toggleAppBarEdgy = function (keyboardInvoked) {
                    var bars = _getDynamicBarsForEdgy();

                    // If they're all open, close them. Otherwise open them all
                    if (bars._opened && !bars._closed) {
                        appBarSynchronizationPromise = appBarSynchronizationPromise.then(function () {
                            return _closeAllBars(bars, keyboardInvoked);
                        });
                        return "closing";
                    } else {
                        appBarSynchronizationPromise = appBarSynchronizationPromise.then(function () {
                            return _openAllBars(bars, keyboardInvoked);
                        });
                        return "opening";
                    }
                };

                return AppBar;
            })
        });

    })(WinJS);
});
