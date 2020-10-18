// Generated by CoffeeScript 2.5.1
(function() {
  /*
  This is a parser class. It has a parse() method and parsing primitives for the
  grammar. It calls methods in the receiver class, when a rule matches:
  */
  var Parser, TRACE,
    indexOf = [].indexOf;

  require('./prelude');

  require('./grammar');

  TRACE = Boolean(ENV.TRACE);

  global.Parser = Parser = class Parser extends Grammar {
    constructor(receiver) {
      super();
      receiver.parser = this;
      this.receiver = receiver;
      this.pos = 0;
      this.end = 0;
      this.state = [];
      this.trace_num = 0;
      this.trace_line = 0;
      this.trace_on = true;
      this.trace_off = 0;
      this.trace_info = ['', '', ''];
    }

    parse(input1) {
      var err, ok;
      this.input = input1;
      this.end = this.input.length;
      if (TRACE) {
        this.trace_on = !this.trace_start();
      }
      try {
        ok = this.call(this.TOP);
        this.trace_flush();
      } catch (error) {
        err = error;
        this.trace_flush();
        throw err;
      }
      if (!ok) {
        throw "Parser failed";
      }
      if (this.pos < this.end) {
        throw "Parser finished before end of input";
      }
      return true;
    }

    state_curr() {
      return this.state[this.state.length - 1] || {
        name: null,
        doc: false,
        lvl: 0,
        beg: 0,
        end: 0,
        m: null,
        t: null
      };
    }

    state_prev() {
      return this.state[this.state.length - 2];
    }

    state_push(name) {
      var curr;
      curr = this.state_curr();
      return this.state.push({
        name: name,
        doc: curr.doc,
        lvl: curr.lvl + 1,
        beg: this.pos,
        end: null,
        m: curr.m,
        t: curr.t
      });
    }

    state_pop() {
      var child, curr;
      child = this.state.pop();
      curr = this.state_curr();
      if (curr == null) {
        return;
      }
      curr.beg = child.beg;
      return curr.end = this.pos;
    }

    call(func, type = 'boolean') {
      var args, pos, trace, value;
      args = [];
      if (isArray(func)) {
        [func, ...args] = func;
      }
      if (isNumber(func) || isString(func)) {
        return func;
      }
      if (!isFunction(func)) {
        FAIL(`Bad call type '${typeof_(func)}' for '${func}'`);
      }
      trace = func.trace != null ? func.trace : func.trace = func.name;
      this.state_push(trace);
      this.trace_num++;
      if (TRACE) {
        this.trace('?', trace, args);
      }
      if (func.name === 'l_bare_document') {
        this.state_curr().doc = true;
      }
      args = args.map((a) => {
        if (isArray(a)) {
          return this.call(a, 'any');
        } else if (isFunction(a)) {
          return a();
        } else {
          return a;
        }
      });
      pos = this.pos;
      this.receive(func, 'try', pos);
      value = func.apply(this, args);
      while (isFunction(value) || isArray(value)) {
        value = this.call(value);
      }
      if (type !== 'any' && typeof_(value) !== type) {
        FAIL(`Calling '${trace}' returned '${typeof_(value)}' instead of '${type}'`);
      }
      this.trace_num++;
      if (type !== 'boolean') {
        if (TRACE) {
          this.trace('>', value);
        }
      } else {
        if (value) {
          if (TRACE) {
            this.trace('+', trace);
          }
          this.receive(func, 'got', pos);
        } else {
          if (TRACE) {
            this.trace('x', trace);
          }
          this.receive(func, 'not', pos);
        }
      }
      this.state_pop();
      return value;
    }

    receive(func, type, pos) {
      var receiver;
      if (func.receivers == null) {
        func.receivers = this.make_receivers();
      }
      receiver = func.receivers[type];
      if (!receiver) {
        return;
      }
      return receiver.call(this.receiver, {
        text: this.input.slice(pos, this.pos),
        state: this.state_curr(),
        start: pos
      });
    }

    make_receivers() {
      var i, m, n, name, names;
      i = this.state.length;
      names = [];
      while (i > 0 && !((n = this.state[--i].name).match(/_/))) {
        if (m = n.match(/^chr\((.)\)$/)) {
          n = 'x' + hex_char(m[1]);
        } else {
          n = n.replace(/\(.*/, '');
        }
        names.unshift(n);
      }
      name = [n, ...names].join('__');
      return {
        try: this.receiver.constructor.prototype[`try__${name}`],
        got: this.receiver.constructor.prototype[`got__${name}`],
        not: this.receiver.constructor.prototype[`not__${name}`]
      };
    }

    // Match all subrule methods:
    all(...funcs) {
      var all;
      return all = function() {
        var func, j, len1, pos;
        pos = this.pos;
        for (j = 0, len1 = funcs.length; j < len1; j++) {
          func = funcs[j];
          if (func == null) {
            FAIL('*** Missing function in @all group:', funcs);
          }
          if (!this.call(func)) {
            this.pos = pos;
            return false;
          }
        }
        return true;
      };
    }

    // Match any subrule method. Rules are tried in order and stops on first
    // match:
    any(...funcs) {
      var any;
      return any = function() {
        var func, j, len1;
        for (j = 0, len1 = funcs.length; j < len1; j++) {
          func = funcs[j];
          if (this.call(func)) {
            return true;
          }
        }
        return false;
      };
    }

    may(func) {
      var may;
      return may = function() {
        return this.call(func);
      };
    }

    // Repeat a rule a certain number of times:
    rep(min, max, func) {
      var rep;
      if ((max != null) && max < 0) {
        FAIL(`rep max is < 0 '${max}'`);
      }
      rep = function() {
        var count, pos, pos_start;
        count = 0;
        pos = this.pos;
        pos_start = pos;
        while (!(max != null) || count < max) {
          if (!this.call(func)) {
            break;
          }
          if (this.pos === pos) {
            break;
          }
          count++;
          pos = this.pos;
        }
        if (count >= min && (!(max != null) || count <= max)) {
          return true;
        }
        this.pos = pos_start;
        return false;
      };
      return name_('rep', rep, `rep(${min},${max})`);
    }

    rep2(min, max, func) {
      var rep2;
      if ((max != null) && max < 0) {
        FAIL(`rep2 max is < 0 '${max}'`);
      }
      rep2 = function() {
        var count, pos, pos_start;
        count = 0;
        pos = this.pos;
        pos_start = pos;
        while (!(max != null) || count < max) {
          if (!this.call(func)) {
            break;
          }
          if (this.pos === pos) {
            break;
          }
          count++;
          pos = this.pos;
        }
        if (count >= min && (!(max != null) || count <= max)) {
          return true;
        }
        this.pos = pos_start;
        return false;
      };
      return name_('rep2', rep2, `rep2(${min},${max})`);
    }

    // Call a rule depending on state value:
    case(var_, map) {
      var case_;
      case_ = function() {
        var rule;
        rule = map[var_];
        (rule != null) || FAIL(`Can't find '${var_}' in:`, map);
        return this.call(rule);
      };
      return name_('case', case_, `case(${var_},${stringify(map)})`);
    }

    // Call a rule depending on state value:
    flip(var_, map) {
      var value;
      value = map[var_];
      (value != null) || FAIL(`Can't find '${var_}' in:`, map);
      if (isString(value)) {
        return value;
      }
      return this.call(value, 'number');
    }

    the_end() {
      return this.pos >= this.end || (this.state_curr().doc && this.start_of_line() && this.input.slice(this.pos).match(/^(?:---|\.\.\.)(?=\s|$)/));
    }

    // Match a single char:
    chr(char) {
      var chr;
      chr = function() {
        if (this.the_end()) {
          return false;
        }
        if (this.input[this.pos] === char) {
          this.pos++;
          return true;
        }
        return false;
      };
      return name_('chr', chr, `chr(${stringify(char)})`);
    }

    // Match a char in a range:
    rng(low, high) {
      var rng;
      rng = function() {
        var ref;
        if (this.the_end()) {
          return false;
        }
        if ((low <= (ref = this.input[this.pos]) && ref <= high)) {
          this.pos++;
          return true;
        }
        return false;
      };
      return name_('rng', rng, `rng(${stringify(low)},${stringify(high)})`);
    }

    // Must match first rule but none of others:
    but(...funcs) {
      var but;
      return but = function() {
        var func, j, len1, pos1, pos2, ref;
        if (this.the_end()) {
          return false;
        }
        pos1 = this.pos;
        if (!this.call(funcs[0])) {
          return false;
        }
        pos2 = this.pos;
        this.pos = pos1;
        ref = funcs.slice(1);
        for (j = 0, len1 = ref.length; j < len1; j++) {
          func = ref[j];
          if (this.call(func)) {
            this.pos = pos1;
            return false;
          }
        }
        this.pos = pos2;
        return true;
      };
    }

    chk(type, expr) {
      var chk;
      chk = function() {
        var ok, pos;
        pos = this.pos;
        if (type === '<=') {
          this.pos--;
        }
        ok = this.call(expr);
        this.pos = pos;
        if (type === '!') {
          return !ok;
        } else {
          return ok;
        }
      };
      return name_('chk', chk, `chk(${type}, ${stringify(expr)})`);
    }

    set(var_, expr) {
      var set;
      set = () => {
        var i, size, state, value;
        value = this.call(expr, 'any');
        if (value === -1) {
          return false;
        }
        if (value === 'auto-detect') {
          value = this.auto_detect();
        }
        state = this.state_prev();
        state[var_] = value;
        if (state.name !== 'all') {
          size = this.state.length;
          i = 3;
          while (i < size) {
            if (i > size - 2) {
              FAIL("failed to traverse state stack in 'set'");
            }
            state = this.state[size - i++ - 1];
            state[var_] = value;
            if (state.name === 's_l_block_scalar') {
              break;
            }
          }
        }
        return true;
      };
      return name_('set', set, `set('${var_}', ${stringify(expr)})`);
    }

    max(max) {
      return max = function() {
        return true;
      };
    }

    exclude(rule) {
      var exclude;
      return exclude = function() {
        return true;
      };
    }

    add(x, y) {
      var add;
      add = () => {
        if (isFunction(y)) {
          y = this.call(y, 'number');
        }
        if (!isNumber(y)) {
          FAIL(`y is '${stringify(y)}', not number in 'add'`);
        }
        return x + y;
      };
      return name_('add', add, `add(${x},${stringify(y)})`);
    }

    sub(x, y) {
      var sub;
      return sub = function() {
        return x - y;
      };
    }

    // This method does not need to return a function since it is never
    // called in the grammar.
    match() {
      var beg, end, i, state;
      state = this.state;
      i = state.length - 1;
      while (i > 0 && (state[i].end == null)) {
        if (i === 1) {
          FAIL("Can't find match");
        }
        i--;
      }
      ({beg, end} = state[i]);
      return this.input.slice(beg, end);
    }

    len(str) {
      var len;
      return len = function() {
        if (!isString(str)) {
          str = this.call(str, 'string');
        }
        return str.length;
      };
    }

    ord(str) {
      var ord;
      return ord = function() {
        if (!isString(str)) {
          str = this.call(str, 'string');
        }
        return str.charCodeAt(0) - 48;
      };
    }

    if(test, do_if_true) {
      var if_;
      if_ = function() {
        if (!isBoolean(test)) {
          test = this.call(test, 'boolean');
        }
        if (test) {
          this.call(do_if_true);
          return true;
        }
        return false;
      };
      return name_('if', if_);
    }

    lt(x, y) {
      var lt;
      lt = function() {
        if (!isNumber(x)) {
          x = this.call(x, 'number');
        }
        if (!isNumber(y)) {
          y = this.call(y, 'number');
        }
        return x < y;
      };
      return name_('lt', lt, `lt(${stringify(x)},${stringify(y)})`);
    }

    le(x, y) {
      var le;
      le = function() {
        if (!isNumber(x)) {
          x = this.call(x, 'number');
        }
        if (!isNumber(y)) {
          y = this.call(y, 'number');
        }
        return x <= y;
      };
      return name_('le', le, `le(${stringify(x)},${stringify(y)})`);
    }

    m() {
      var m;
      return m = () => {
        return this.state_curr().m;
      };
    }

    t() {
      var t;
      return t = () => {
        return this.state_curr().t;
      };
    }

    //------------------------------------------------------------------------------
    // Special grammar rules
    //------------------------------------------------------------------------------
    start_of_line() {
      return this.pos === 0 || this.pos >= this.end || this.input[this.pos - 1] === "\n";
    }

    end_of_stream() {
      return this.pos >= this.end;
    }

    empty() {
      return true;
    }

    auto_detect_indent(n) {
      var indent, m;
      m = this.input.slice(this.pos).match(/^(\ *)/);
      indent = m[1].length - n;
      if (indent > 0) {
        return indent;
      } else {
        return -1;
      }
    }

    auto_detect(n) {
      var m;
      m = this.input.slice(this.pos).match(/^.*\n(?:\ *\n)*(\ *)/);
      if (!m) {
        return 0;
      }
      m = m[1].length - n;
      if (m < 0) {
        return 0;
      }
      return m;
    }

    //------------------------------------------------------------------------------
    // Trace debugging
    //------------------------------------------------------------------------------
    trace_start() {
      return '' || ENV.TRACE_START;
    }

    trace_quiet() {
      if (ENV.DEBUG) {
        return [];
      }
      return ['c_directives_end', 'c_l_folded', 'c_l_literal', 'c_ns_alias_node', 'c_ns_anchor_property', 'c_ns_tag_property', 'l_directive_document', 'l_document_prefix', 'ns_flow_content', 'ns_plain', 's_l_comments', 's_separate'].concat((ENV.TRACE_QUIET || '').split(','));
    }

    trace(type, call, args = []) {
      var indent, input, l, level, line, prev_level, prev_line, prev_type, trace_info, trace_num;
      if (!isString(call)) { // XXX
        call = String(call);
      }
      if (call.match(/^($| |.* $)/)) {
        call = `'${call}'`;
      }
      if (!(this.trace_on || call === this.trace_start())) {
        return;
      }
      level = this.state_curr().lvl;
      indent = _.repeat(' ', level);
      if (level > 0) {
        l = `${level}`.length;
        indent = `${level}` + indent.slice(l);
      }
      input = this.input.slice(this.pos);
      if (input.length > 30) {
        input = `${input.slice(0, 31)}…`;
      }
      input = input.replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
      line = sprintf("%s%s %-40s  %4d '%s'", indent, type, this.trace_format_call(call, args), this.pos, input);
      if (ENV.DEBUG) {
        warn(sprintf("%6d %s", this.trace_num, line));
        return;
      }
      trace_info = null;
      level = `${level}_${call}`;
      if (type === '?' && this.trace_off === 0) {
        trace_info = [type, level, line, this.trace_num];
      }
      if (indexOf.call(this.trace_quiet(), call) >= 0) {
        this.trace_off += type === '?' ? 1 : -1;
      }
      if (type !== '?' && this.trace_off === 0) {
        trace_info = [type, level, line, this.trace_num];
      }
      if (trace_info != null) {
        [prev_type, prev_level, prev_line, trace_num] = this.trace_info;
        if (prev_type === '?' && prev_level === level) {
          trace_info[1] = '';
          if (line.match(/^\d*\ *\+/)) {
            prev_line = prev_line.replace(/\?/, '=');
          } else {
            prev_line = prev_line.replace(/\?/, '!');
          }
        }
        if (prev_level) {
          warn(sprintf("%5d %6d %s", ++this.trace_line, trace_num, prev_line));
        }
        this.trace_info = trace_info;
      }
      if (call === this.trace_start()) {
        return this.trace_on = !this.trace_on;
      }
    }

    trace_format_call(call, args) {
      var list;
      if (!args.length) {
        return call;
      }
      list = args.map(function(a) {
        return stringify(a);
      });
      list = list.join(',');
      return `${call}(${list})`;
    }

    trace_flush() {
      var count, level, line, type;
      [type, level, line, count] = this.trace_info;
      if (line) {
        return warn(sprintf("%5d %6d %s", ++this.trace_line, count, line));
      }
    }

  };

  // vim: sw=2:

}).call(this);
