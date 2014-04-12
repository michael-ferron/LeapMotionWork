/**
 * User input streams from Leap controllers
 */


/* ===== Streamers ========= */

/**
 * sending a data downstream of a streamer
 */
function _yield(streamer, data) {
    if(streamer.downstream && streamer.downstream.length > 0) {
        streamer.downstream.forEach(function(d) {
            d.consume(data);
        });
    }
}

/**
 * connects downstream to upstream
 */
function _connect(upstream, downstream) {
    if(upstream.downstream == null) {
        upstream.downstream = [];
    }
    upstream.downstream.push(downstream);
}
/**
 * Chain connect a series of streamers
 */
function Connect() {
    for(var i=1; i < arguments.length; i++) {
        _connect(arguments[i-1], arguments[i]);
    }
}


/* ===== Leap stream ======= */

function LeapStream() {
    var leapLoop = new Leap.Controller({enableGesture: false});
    var self = this;
    self.downstream = [];

    leapLoop.loop(function(frame) {
        self.downstream.forEach(function(f) {
            f.consume(frame);
        });
    });
}

/* ======= Jan 27: Dominant hand filter ========== */

/**
 * Identify dominant hand
 * Input:
 *      Leapstream
 * Output:
 *      Stream<Hand>
 */
function DominantHandFilter(enabled, freqThreshold) {
    this.counter = {};
    this.c0 = freqThreshold;
    this.domHandId = null;
    this.domHandFreq = 0;
    this.enabled = enabled;
    this.stabilized = false;
}
DominantHandFilter.prototype.updateCounter = function(hand) {
    var id = hand.id;
    if(this.counter[id] == null) {
        this.counter[id] = 1;
    } else {
        this.counter[id] += 1;
    }
    if(this.counter[id] > this.domHandFreq) {
        this.domHandId = id;
        this.domHandFreq = this.counter[id];
    }
}
DominantHandFilter.prototype.reset = function() {
    this.counter = {};
    this.stabilized = false;
    this.domHandId = null;
    this.domHandFreq = 0;
}

DominantHandFilter.prototype.consume = function(frame) {
    var self = this;

    if(frame.hands.length == 0) {
        self.reset();
        _yield(self, null);
        return;
    }

    if(! this.enabled) {
        console.debug("hand filter disabled");
        _yield(self, frame.hands[0]);
        return;
    }

    // identify the dominant hand
    if(! self.stabilized) {
        frame.hands.forEach(function(hand) {
            self.updateCounter(hand);
        });

        if(self.domHandFreq > self.c0) {
            self.stabilized = true;
        }
        
        _yield(self, null);
    } else {
        var domHand;
        frame.hands.forEach(function(hand) {
            if(hand.id == self.domHandId) {
                domHand = hand;
                return false;
            }
        });
        if(domHand) {
            _yield(self, domHand);
        } else {
            self.reset();
            _yield(self, null);
        }
    }
}

function DominantPointerFilter(enabled, threshold) {
    this.state = 'closed'; // 'open', 'ptr', 'ptr-stable'
    this.domFinger = null;
    this.domFreq = 0;
    this.count = {};
    this.enabled = enabled;
    this.freqThreshold = threshold;
}
DominantPointerFilter.prototype.consume = function(hand) {
    var self = this;

    if(! hand) {
        this.state = 'closed';
    } else {
        var fingers = hand.fingers.length;
        if(fingers == 0) {
            this.state = 'closed';
        } else if(fingers >= 3) {
            this.state = 'open';
        } else {
            this.state = 'ptr';
        }
    }

    if(this.state == 'ptr') {
        var domFinger;
        // figure out the dominant pointing finger
        if(this.enabled) {
            this.updateCount(hand.fingers);
            if(this.domFreq > this.freqThreshold) {
                domFinger = this.domFinger;
            }
        } else {
            domFinger = hand.fingers[0];
        }
        // sets the tip and pointer fields
        this.updateHand(hand, domFinger);
    } else {
        this.reset();
    }

    _yield(self, hand);
}

DominantPointerFilter.prototype.updateCount = function(fingers) {
    var self = this;
    fingers.forEach(function(finger) {
        self.count[finger.id] = (self.count[finger.id] != null) ? (self.count[finger.id]+1) : 1;
        if(self.count[finger.id] > self.domFreq) {
            self.domFinger = finger;
            self.domFreq = self.count[finger.id];
        }
    });
}
DominantPointerFilter.prototype.updateHand = function(hand, f) {
    if(f) {
        hand.pointer = f.direction.slice();
        hand.tip = f.stabilizedTipPosition.slice();
    } else {
        hand.pointer = null;
        hand.tip = null;
    }
}
DominantPointerFilter.prototype.reset = function() {
    this.count = {};
    this.domFinger = null;
    this.domFreq = 0;
}

/**
 * DebugHand
 */
function DebugFilter(element) {
    this.element = $(element);
}
DebugFilter.prototype.consume = function(hand) {
    var angles, pos;
    if(hand == null) {
        angles = [0, 0, 0];
        pos = [0, 0, 0];
        ptr = [0, 0, 0];
    } else {
        angles = hand.palmNormal.slice();
        pos    = hand.stabilizedPalmPosition.slice();
        ptr    = (hand.pointer) ? hand.pointer.slice() : [0,0,0];
    }
    if(this.element) {
        var element = this.element;
        element.find(".angle-x").text(sprintf("%2.2f", angles[0]));
        element.find(".angle-y").text(sprintf("%2.2f", angles[1]));
        element.find(".angle-z").text(sprintf("%2.2f", angles[2]));

        element.find(".position-x").text(sprintf("%2.2f", pos[0]));
        element.find(".position-y").text(sprintf("%2.2f", pos[1]));
        element.find(".position-z").text(sprintf("%2.2f", pos[2]));

        element.find(".pointer-x").text(sprintf("%2.2f", ptr[0]));
        element.find(".pointer-y").text(sprintf("%2.2f", ptr[1]));
        element.find(".pointer-z").text(sprintf("%2.2f", ptr[2]));
    }

    // console.debug("DEBUG", hand)
    _yield(this, hand);
}



/**
 * Normalize
 * Input:
 *      Stream<Hand>
 * Output:
 *      Stream<palm: AngleVec, pos: PositionVec>
 */
function Normalize() {
}
Normalize.prototype.normalize = function(x, xmin, xmax, ymin, ymax) {
    x = Math.min(x, xmax);
    x = Math.max(x, xmin);
    var y = ymin + (x - xmin)/(xmax-xmin) * (ymax - ymin);
    return y;
}

Normalize.prototype.consume = function(hand) {
    if(hand) {
        //
        // normalize palm normal vector to [0 1]
        //
        var a0 = hand.palmNormal[0];
        var a1 = hand.palmNormal[1];
        var a2 = hand.palmNormal[2];
        a0 = this.normalize(a0, -1, 1, 0, 1.0);
        a1 = this.normalize(a1, -1, 1, 0, 1.0);
        a2 = this.normalize(a2, -0.7, 0.7, 0, 1.0);
        hand.palmNormal = [a0, a1, a2];

        //
        // normalize palm position to [0 1]
        //
        var p0 = hand.stabilizedPalmPosition[0];
        var p1 = hand.stabilizedPalmPosition[1];
        var p2 = hand.stabilizedPalmPosition[2];
        p0 = this.normalize(p0, -150, 150, 0, 1.0);
        p1 = this.normalize(p1, 50, 300, 1.0, 0);
        p2 = this.normalize(p2, -150, 150, 0, 1.0);
        hand.stabilizedPalmPosition = [p0, p1, p2];

        //
        // normalize pointer vector to [0 1]
        //
        if(hand.pointer) {
            var a0 = hand.pointer[0];
            var a1 = hand.pointer[1];
            var a2 = hand.pointer[2];
            a0 = this.normalize(a0, -1, 1, 0, 1.0);
            a1 = this.normalize(a1, -1, 1, 0, 1.0);
            a2 = this.normalize(a2, -0.7, 0.7, 0, 1.0);
            hand.pointer = [a0, a1, a2];
        }
    }
    _yield(this, hand);
}

function ArchiveFilter(exp) {
    this.exp = exp || "blank";
    this.data = [];
}
ArchiveFilter.prototype.consume = function(hand) {
    if(hand) {
        this.data.push(this.serialize(hand));
    } else {
        if(this.data.length > 0) {
            this.save();
            this.data.length = 0;
        }
    }
    _yield(this, hand);
}

ArchiveFilter.prototype.serialize = function(hand) {
    var data = {};
    if(hand.palmNormal) data.palmNormal = hand.palmNormal.slice();
    if(hand.stabilizedPalmPosition) data.stabilizedPalmPosition = hand.stabilizedPalmPosition.slice();
    if(hand.pointer) data.pointer = hand.pointer.slice();
    if(hand.frame && hand.frame.timestamp) data.timestamp = hand.frame.timestamp;

    return data;
}
ArchiveFilter.prototype.save = function() {
    console.debug("Saving back to server observations:", this.data.length);
    var data = JSON.stringify(this.data);
    $.post("/save/" + this.exp, {data: data});
}

/**
 * Update the scope with leap motion 3D data
 */
function ScopeUpdate($scope, dataField, defaults) {
    this.scope = $scope;
    this.field = dataField;
    this.defaults = defaults || {};
    var noop = function() { return null; }
    if(! this.defaults.ptr) this.defaults.ptr = noop;
    if(! this.defaults.tip) this.defaults.tip = noop;
    if(! this.defaults.palm) this.defaults.palm = noop;
    if(! this.defaults.pos) this.defaults.pos = noop;

    $scope.X = 0, $scope.Y = 1; $scope.Z = 2;
}
ScopeUpdate.prototype.consume = function(hand) {
    var self = this;
    self.scope.$apply(function() {
        var data = self.scope[self.field];
        if(hand) {
            data.fcount = hand.fingers.length;
            data.palm = hand.palmNormal.slice();
            data.pos  = hand.stabilizedPalmPosition.slice();
            if(hand.pointer) {
                data.ptr  = hand.pointer.slice();
                data.tip  = hand.tip.slice();
            } else {
                data.ptr  = self.defaults.ptr(hand);
                data.tip  = self.defaults.tip(hand);
            }
        } else {
            data.palm = self.defaults.palm(hand);
            data.pos  = self.defaults.pos(hand);
            data.ptr  = self.defaults.ptr(hand);
            data.tip  = self.defaults.tip(hand);
        }
        // console.debug("scope.data =", data)
    });
    _yield(this, hand);
}

/**
 * Recognizes ultra simple gestures of page turning
 */
function GestureRecognizer($scope) {
    this.scope = $scope;
}
GestureRecognizer.prototype.consume = function(hand) {
    var gesture = {};
    if(hand && hand.fingers.length == 0) {
        if(hand.stabilizedPalmPosition[2] > 0.95) {
            this.scope.$apply(function() {
				if(!$scope.inTransition)
				{
					this.scope.NextSlide();
					$scope.inTransition = true;
				}
            });
        }
        else if(hand.stabilizedPalmPosition[2] < 0.05) {
            this.scope.$apply(function() {
				if(!$scope.inTransition)
				{
					this.scope.PreviousSlide();
					$scope.inTransition = false;
				}
            });
        }
    }
}