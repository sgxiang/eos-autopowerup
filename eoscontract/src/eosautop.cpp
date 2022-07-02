#include <eosautop.hpp>

using namespace eosio;

void eosautop::withdraw(name user)
{
  require_auth(get_self());
  puser_index puser(get_self(), "eosio.token"_n.value);
  auto use_iterator = puser.find(user.value);
  check(use_iterator != puser.end(), "User does not exist");
  action(
      permission_level{get_self(), "withdraw"_n},
      "eosio.token"_n,
      "transfer"_n,
      std::make_tuple(get_self(), user, use_iterator->balance, std::string("withdraw")))
      .send();
  puser.modify(use_iterator, get_self(), [&](auto &row)
               {
    row.user = user;
    row.balance = asset{0, {"EOS", 4}}; });
}

void eosautop::getfee()
{
  require_auth(get_self());
  puser_index puser(get_self(), "eosio.token"_n.value);
  auto puser_iterator = puser.find(get_self().value);
  check(puser_iterator != puser.end(), "Record does not exist");

  action(
      permission_level{get_self(), "active"_n},
      "eosio.token"_n,
      "transfer"_n,
      std::make_tuple(get_self(), "xxxxxxxx"_n, puser_iterator->balance, std::string("get fee")))
      .send();

  puser.modify(puser_iterator, get_self(), [&](auto &row)
               {
    row.user = get_self();
    row.balance = asset{0, {"EOS", 4}}; });
}

void eosautop::on_eos_transfer(name from, name to, eosio::asset quantity, std::string memo)
{
  if (from == get_self() || to != get_self())
  {
    return;
  }
  puser_index puser(get_self(), get_first_receiver().value);
  auto iterator = puser.find(from.value);
  check(quantity.amount >= 5000, "最低充值金额0.5000 EOS");
  asset fee = asset{int64_t(quantity.amount * 0.01), {"EOS", 4}};
  asset balance = asset{int64_t(quantity.amount - fee.amount), {"EOS", 4}};
  if (iterator == puser.end())
  {
    puser.emplace(get_self(), [&](auto &row)
                  {
      row.user = from;
      row.balance = balance; });
  }
  else
  {
    puser.modify(iterator, get_self(), [&](auto &row)
                 {
      row.user = from;
      row.balance = row.balance + balance; });
  }
  auto fee_iterator = puser.find(get_self().value);
  if (fee_iterator == puser.end())
  {
    puser.emplace(get_self(), [&](auto &row)
                  {
      row.user = get_self();
      row.balance = fee; });
  }
  else
  {
    puser.modify(fee_iterator, get_self(), [&](auto &row)
                 {
      row.user = get_self();
      row.balance = row.balance + fee; });
  }
}

void eosautop::autopowerup(name user, name receiver, uint64_t net_frac, uint64_t cpu_frac, asset max_payment)
{
  require_auth(get_self());
  // 储存自己的余额
  asset eos_balance = utils::get_balance("eosio.token"_n, get_self(), symbol_code("EOS"));
  state_index state(get_self(), "eosio.token"_n.value);
  state.emplace(get_self(), [&](auto &row)
                {
    row.contract = "eosio.token"_n;
    row.balance = eos_balance; });

  puser_index puser(get_self(), "eosio.token"_n.value);
  auto iterator = puser.find(user.value);
  check(iterator != puser.end(), "User does not exist");
  // 发起powerup
  action(
      permission_level{get_self(), "powerup"_n},
      "eosio"_n,
      "powerup"_n,
      std::make_tuple(
          get_self(),
          receiver,
          1,
          net_frac,
          cpu_frac,
          max_payment))
      .send();

  action(
      permission_level{get_self(), "powerup"_n},
      get_self(),
      "billaccount"_n,
      std::make_tuple(
          user))
      .send();
}


void eosautop::billaccount(name receiver)
{
  require_auth(get_self());
  asset eos_balance = utils::get_balance("eosio.token"_n, get_self(), symbol_code("EOS"));
  state_index state(get_self(), "eosio.token"_n.value);
  auto iterator = state.find("eosio.token"_n.value);
  check(iterator != state.end(), "Record does not exist");
  asset old_eos_balance = iterator->balance;
  state.erase(iterator);
  // 获取用户表
  puser_index puser(get_self(), "eosio.token"_n.value);
  auto use_iterator = puser.find(receiver.value);
  check(use_iterator != puser.end(), "User does not exist");
  asset new_user_balance = use_iterator->balance - (old_eos_balance - eos_balance);
  check(new_user_balance.amount > 0, "Balance is not enough");
  puser.modify(use_iterator, get_self(), [&](auto &row)
               {
    row.user = receiver;
    row.balance = new_user_balance; });
}

void eosautop::setconfig(name user, uint64_t min_cpu, uint64_t cpu_amount, uint64_t min_net, uint64_t net_amount, uint64_t open)
{
  require_auth(user);
  pconfig2_index pconfig2(get_self(), get_first_receiver().value);
  auto iterator = pconfig2.find(user.value);
  if (iterator == pconfig2.end())
  {
    pconfig2.emplace(user, [&](auto &row)
                     {
      row.user = user;
      row.min_cpu = min_cpu;
      row.cpu_amount = cpu_amount;
      row.min_net = min_net;
      row.net_amount = net_amount;
      row.open = open; });
  }
  else
  {
    pconfig2.modify(iterator, user, [&](auto &row)
                    {
      row.user = user;
      row.min_cpu = min_cpu;
      row.cpu_amount = cpu_amount;
      row.min_net = min_net;
      row.net_amount = net_amount;
      row.open = open; });
  }
}


void eosautop::setusers(name user, std::string users)
{
  check(has_auth(user) || has_auth(get_self()), "无权限");
  cusers_index cusers(get_self(), get_first_receiver().value);
  auto iterator = cusers.find(user.value);
  if (iterator == cusers.end())
  {
    cusers.emplace(has_auth(user) ? user : get_self(), [&](auto &row)
                   {
      row.user = user;
      row.users = users; });
  }
  else
  {
    cusers.modify(iterator, has_auth(user) ? user : get_self(), [&](auto &row)
                  {
      row.user = user;
      row.users = users; });
  }
}
