#include <eosio/eosio.hpp>
#include <utils.hpp>

using namespace eosio;

class [[eosio::contract("eosautop")]] eosautop : public eosio::contract
{

public:
  eosautop(name receiver, name code, datastream<const char *> ds) : contract(receiver, code, ds) {}

  [[eosio::action]] void getfee();

  [[eosio::action]] void withdraw(name user);

  [[eosio::on_notify("eosio.token::transfer")]] void on_eos_transfer(name from, name to, eosio::asset quantity, std::string memo);

  [[eosio::action]] void autopowerup(name user, name receiver, uint64_t net_frac, uint64_t cpu_frac, asset max_payment);
  [[eosio::action]] void billaccount(name receiver);
  [[eosio::action]] void setconfig(name user, uint64_t min_cpu, uint64_t cpu_amount, uint64_t min_net, uint64_t net_amount, uint64_t open);
  [[eosio::action]] void setusers(name user, std::string users);

private:
  struct [[eosio::table]] state
  {
    name contract;
    asset balance;
    uint64_t primary_key() const { return contract.value; }
  };
  using state_index = eosio::multi_index<"state"_n, state>;

  struct [[eosio::table]] puser
  {
    name user;
    asset balance;
    uint64_t primary_key() const { return user.value; }
  };
  using puser_index = eosio::multi_index<"puser"_n, puser>;

  struct [[eosio::table]] pconfig2
  {
    name user;
    uint64_t min_cpu;
    uint64_t cpu_amount;
    uint64_t min_net;
    uint64_t net_amount;
    uint64_t open;
    uint64_t primary_key() const { return user.value; }
  };
  using pconfig2_index = eosio::multi_index<"pconfig2"_n, pconfig2>;

  struct [[eosio::table]] cusers
  {
    name user;
    std::string users;
    uint64_t primary_key() const { return user.value; }
  };
  using cusers_index = eosio::multi_index<"cusers"_n, cusers>;
};