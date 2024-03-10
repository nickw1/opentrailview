class Eventable {
    constructor() {
        this.events = {};
    }

    on(eventName, cb) {
        this.events[eventName] = cb;
    }
}

export default Eventable;
