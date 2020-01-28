class Orig {
  constructor() {
    this.to = "";
  }

  sayHi(to) {
    if (to && this.to != to) {
      if (typeof to == "function") {
        this.to = to();
      } else {
        this.to = to;
      }
    }
    console.log("Hi", this.to);
    return this;
  }

  sayHello(to) {
    if (to && this.to != to) {
      if (typeof to == "function") {
        this.to = to();
      } else {
        this.to = to;
      }
    }
    console.log("Hello", this.to);
    return this;
  }
}

class Caller {
  constructor() {
    this.orig = new Orig();
    this.anything = "Anything";
    
    this.sayHi("Something").sayHello(this.doSomething(this));

    this.sayHi("World").sayHello(() => {
      return this.doAnything();
    });
  }

  doSomething(self) {
    return () => {
      return self.anything;
    };
  }

  doAnything() {
    return this.anything;
  }

  sayHi(to) {
    this.orig.sayHi(to);
    return this;
  }

  sayHello(to) {
    this.orig.sayHello(to);
    return this;
  }
}

describe("GET /", function() {
  it("test", function(done) {
    const c = new Caller();
    console.log("Ok");
    setImmediate(done);
  });
});