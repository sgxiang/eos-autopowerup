const axios = require("axios");
const { Api, JsonRpc, RpcError } = require("eosjs");
const { JsSignatureProvider } = require("eosjs/dist/eosjs-jssig");
const fetch = require("node-fetch");
const { TextEncoder, TextDecoder } = require("util");
const _ = require("lodash");
const moment = require("moment");
const defaultPrivateKey = "xxxxxxxxxxxxx"; // 合约私钥
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

var miner = {};
var cpu_price = -1;
var nodes = ["https://eospush.tokenpocket.pro"];

const you_contract_account = "xxxxxx";

// ======================================== 生成从minNum到maxNum的随机数 ========================================
function randomNum(minNum, maxNum) {
  switch (arguments.length) {
    case 1:
      return parseInt(Math.random() * minNum + 1, 10);
      break;
    case 2:
      return parseInt(Math.random() * (maxNum - minNum + 1) + minNum, 10);
      break;
    default:
      return 0;
      break;
  }
}

// ======================================== 获取配置 ========================================

function fetch_pconfig() {
  let apis = nodes;
  let index = randomNum(0, apis.length - 1);
  console.log(`fetch_pconfig: ${apis[index]}`);
  const rpc = new JsonRpc(apis[index], { fetch });
  const api = new Api({
    rpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
  });
  var cusers = [];
  var puser = [];
  api.rpc
    .get_table_rows({
      json: true,
      code: you_contract_account,
      scope: "eosio.token",
      table: "puser",
      table_key: "",
      lower_bound: null,
      upper_bound: null,
      index_position: 1,
      key_type: "",
      limit: "2000",
      reverse: false,
      show_payer: false,
    })
    .then((res) => {
      if (res && res.rows) {
        for (let row of res.rows) {
          puser[row.user] = row.balance = parseFloat(row.balance);
        }
      }
      return api.rpc.get_table_rows({
        json: true,
        code: you_contract_account,
        scope: you_contract_account,
        table: "cusers",
        table_key: "",
        lower_bound: null,
        upper_bound: null,
        index_position: 1,
        key_type: "",
        limit: "2000",
        reverse: false,
        show_payer: false,
      });
    })
    .then((res) => {
      if (res && res.rows) {
        for (let row of res.rows) {
          let arr = row.users.split(" ").filter((v2) => {
            return v2.trim() != "";
          });
          cusers[row.user] = arr.length == 0 ? [] : arr;
        }
      }
      return api.rpc.get_table_rows({
        json: true,
        code: you_contract_account,
        scope: you_contract_account,
        table: "pconfig2",
        table_key: "",
        lower_bound: null,
        upper_bound: null,
        index_position: 1,
        key_type: "",
        limit: "2000",
        reverse: false,
        show_payer: false,
      });
    })
    .then((res) => {
      if (res && res.rows) {
        var _miner = {};
        for (let row of res.rows) {
          // 获取到该用户的所有配置用户
          let _users =
            cusers[row.user] !== null && cusers[row.user] !== undefined
              ? cusers[row.user]
              : [row.user];
          for (let _user of _users) {
            _miner[row.user + "_" + _user] = {
              _user: row.user,
              user: _user,
              min_cpu: row.min_cpu,
              cpu_amount: row.cpu_amount,
              min_net: row.min_net,
              net_amount: row.net_amount,
              open: row.open === 1 ? true : false,
              balance: puser[row.user] ? puser[row.user] : 0,
            };
          }
        }
        miner = _miner;
      }
      return api.rpc.get_account(you_contract_account);
    })
    .then((res) => {
      let total_resources = res.total_resources;
      let cpu_weight = total_resources.cpu_weight;
      let cpu_limit = res.cpu_limit;
      cpu_price = parseFloat(cpu_weight) / (cpu_limit.max / 1000);
    })
    .catch((err) => {
      console.log(err);
    })
    .finally(() => {
      setTimeout(() => {
        fetch_pconfig();
      }, 30 * 1000);
    });
}

// ======================================== 启动 ========================================

function start_miner() {
  for (let u of Object.keys(miner)) {
    if (!miner[u].open) {
      continue;
    }
    if (
      miner[u].balance == null ||
      miner[u].balance == undefined ||
      miner[u].balance <= 0.001
    ) {
      continue;
    }
    if (miner[u].lastTime) {
      let now = moment().unix();
      let minerTime = 1;
      if (now - miner[u].lastTime < minerTime * 60) {
        continue;
      }
    }
    check_powerup(miner[u]);
  }
  setTimeout(() => {
    start_miner();
  }, 40 * 1000);
}
fetch_pconfig();
start_miner();

// ======================================== 检查 cpu、net ========================================
function check_powerup(u, use_min) {
  let key = u._user + "_" + u.user;
  var cpu_value = 0;
  var net_value = 0;
  let apis = nodes;
  let index = randomNum(0, apis.length - 1);
  const rpc = new JsonRpc(apis[index], { fetch });
  const api = new Api({
    rpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
  });
  api.rpc
    .get_account(u.user)
    .then((res) => {
      if (res) {
        let cpu_limit = res.cpu_limit;
        let available_ms = cpu_limit.available / 1000;
        let net_limit = res.net_limit;
        let available_kb = net_limit.available / 1024;
        // 判断是否达到要求
        if (available_ms <= miner[key].min_cpu) {
          // 执行powerup
          if (miner[key].cpu_amount > 0) {
            cpu_value = miner[key].cpu_amount;
          }
        }
        var full_zero_cpu_value = 0;
        // 如果可用的cpu小于0了，需要完全补足cpu
        if (cpu_limit.max - cpu_limit.used < 0) {
          if (cpu_price > 0) {
            // 计算补足cpu需要多少
            full_zero_cpu_value =
              -1 * ((cpu_limit.max - cpu_limit.used) / 1000) * cpu_price;
          }
        }
        if (use_min === null || use_min === undefined) {
          if (
            cpu_value > 0 &&
            cpu_limit.max - cpu_limit.used < 0 &&
            full_zero_cpu_value > 0
          ) {
            // 取最大值
            cpu_value = Math.max(cpu_value, full_zero_cpu_value);
            cpu_value = parseInt(`${cpu_value}`);
          }
        }
        if (available_kb <= miner[key].min_net) {
          // 执行powerup
          if (miner[key].net_amount > 0) {
            net_value = miner[key].net_amount;
          }
        }
        if (cpu_value > 0 || net_value > 0) {
          return api.rpc.get_table_rows({
            code: "eosio",
            scope: "",
            table: "powup.state",
          });
        }
      }
    })
    .then((res) => {
      if (res && res.rows && res.rows.length > 0) {
        var powupstate = res.rows[0];
        // console.log("==========");
        // console.log(cpu_value);
        var cpu_fact = 0;
        if (cpu_value > 0) {
          cpu_fact = parseInt(
            Math.round((1e15 * cpu_value * 10000) / powupstate.cpu.weight)
          );
        }
        // console.log(cpu_fact);
        var net_fact = 0;
        if (net_value > 0) {
          net_fact = parseInt(
            Math.round((1e15 * net_value * 10000) / powupstate.net.weight)
          );
        }
        if (net_fact > 0 || cpu_fact > 0) {
          // 执行powerup
          return api.transact(
            {
              actions: [
                {
                  account: you_contract_account,
                  name: "autopowerup",
                  authorization: [
                    {
                      actor: you_contract_account,
                      permission: "powerup",
                    },
                  ],
                  data: {
                    user: u._user,
                    receiver: u.user,
                    net_frac: net_fact,
                    cpu_frac: cpu_fact,
                    max_payment: "2.0000 EOS",
                  },
                },
              ],
            },
            {
              blocksBehind: 3,
              expireSeconds: 60,
            }
          );
        }
      }
    })
    .then((res) => {
      if (res) {
        console.log(
          `${moment().format("YYYY-MM-DD HH:mm:ss")} ${u.user} powerup成功`
        );
      }
    })
    .catch((err) => {
      console.log(
        `${moment().format("YYYY-MM-DD HH:mm:ss")} ${u.user} balance: ${
          u.balance
        } powerup失败: ${err}`
      );
      if (use_min === null || use_min === undefined) {
        check_powerup(u, true);
      }
    })
    .finally(() => {
      if (miner[key]) {
        miner[key].lastTime = moment().unix();
      }
    });
}

// ======================================== CPU 相关计算函数 ========================================
function priceFunction(e, t) {
  var a = parseFloat(e.min_price),
    n = e.exponent - 1;
  return n <= 0
    ? parseFloat(e.max_price)
    : (a +=
        (parseFloat(e.max_price) - parseFloat(e.min_price)) *
        Math.pow(t / e.weight, n));
}
function priceIntegralDelta(e, t, a) {
  var n = (parseFloat(e.max_price) - parseFloat(e.min_price)) / e.exponent,
    o = t / e.weight,
    r = a / e.weight;
  return (
    parseFloat(e.min_price) * r -
    parseFloat(e.min_price) * o +
    n * Math.pow(r, e.exponent) -
    n * Math.pow(o, e.exponent)
  );
}
function calcPowerupFee(powupstate, e, t) {
  var a = 0,
    n = parseFloat(e.utilization),
    o = parseFloat(e.utilization) + parseFloat(t);
  n < e.adjusted_utilization &&
    ((a +=
      (priceFunction(e, e.adjusted_utilization) *
        Math.min(t, e.adjusted_utilization - n)) /
      e.weight),
    (n = e.adjusted_utilization)),
    n < o && (a += priceIntegralDelta(e, n, o));
  var r = powupstate;
  return r && a > 0 && a < r.min_powerup_fee && (a = r.min_powerup_fee), a;
}
