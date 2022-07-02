#include <types.hpp>
namespace utils
{
using std::string;

asset get_balance(const name &token_contract_account, const name &owner, const symbol_code &sym_code)
{
   accounts accountstable(token_contract_account, owner.value);
   const auto &ac = accountstable.get(sym_code.raw());
   return ac.balance;
}

void inline_transfer(name contract, name from, name to, asset quantity, string memo)
{
   action(
       permission_level{from, "active"_n},
       contract,
       name("transfer"),
       make_tuple(from, to, quantity, memo))
       .send();
}

std::vector<string> split(const string &str, const string &delim)
{
   std::vector<string> strs;
   size_t prev = 0, pos = 0;
   do
   {
      pos = str.find(delim, prev);
      if (pos == string::npos)
         pos = str.length();
      string s = str.substr(prev, pos - prev);
      if (!str.empty())
         strs.push_back(s);
      prev = pos + delim.length();
   } while (pos < str.length() && prev < str.length());
   return strs;
}

} // namespace utils