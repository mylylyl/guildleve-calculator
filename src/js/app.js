let serverRegion = 'MaoXiaoPang';

const COS_ENDPOINT = 'https://ff-1251188240.cos.accelerate.myqcloud.com/data_mining/leve/';
//const COS_ENDPOINT = 'https://localhost:2021/';
const PRICE_AMOUNT = 10;

// utils
const open_url = function (url) {
  window.open(url, '_blank');
};

const fetchUniversalis = function (server_region, item_id) {
  return fetch(`https://universalis.app/api/${server_region}/${item_id}`).then((response) => response.json());
};

const get_listings = function (listings, hq) {
  if (listings === undefined || listings.length === 0) return [];
  let l = [];
  for (const listing of listings) l = [...l, ...(listing.hq === hq ? [listing] : [])];
  return l;
};

const calculate_listings_avg = function (listings, amount) {
  listings.sort((la, lb) => la.pricePerUnit - lb.pricePerUnit);
  const filtered_listings = listings.slice(0, amount);
  const sum_price = filtered_listings.reduce((prev, curr) => { return { 'pricePerUnit': prev.pricePerUnit * prev.quantity + curr.pricePerUnit * curr.quantity, 'quantity': 1, }; }).pricePerUnit;
  const sum_quantity = filtered_listings.reduce((prev, curr) => { return { 'quantity': prev.quantity + curr.quantity, }; }).quantity;
  return Math.round(sum_price / sum_quantity);
};

const get_price = function (item, listings, amount, hq) {
  const filtered_listings = get_listings(listings, hq);
  if (filtered_listings.length === 0) {
    console.log(`no listings found for ${item.name} (${hq ? 'hq' : 'nq'})`);
    return 0;
  }
  if (filtered_listings.length < amount) {
    console.log(`not enough listings for ${item.name} (need: ${amount}, have: ${filtered_listings.length})`)
    return calculate_listings_avg(filtered_listings, filtered_listings.length);
  }
  return calculate_listings_avg(filtered_listings, amount);
}

const fetchItemPriceHQ = async function (item) {
  let json = await fetchUniversalis(serverRegion, item.id);
  // stones are only NQ
  if (item.id <= 19) return get_price(item, json.listings, PRICE_AMOUNT, false);
  const hq_listings = get_listings(json.listings, true);
  // no hq
  if (hq_listings.length === 0) {
    console.log(`item ${item.name} is using NQ price`);
    return get_price(item, json.listings, PRICE_AMOUNT, false);
  }
  return get_price(item, json.listings, PRICE_AMOUNT, true);
}

const fetchLeveJson = function (json_name) {
  return fetch(COS_ENDPOINT + json_name + '.json').then((response) => response.json());
};

// ui stuff
const createItemElement = function (item_id, span_text, strong_text, offset) {
  const span = document.createElement('span');
  span.setAttribute('data-ck-item-id', item_id);
  span.setAttribute('onclick', `open_url('https://universalis.app/market/${item_id}')`);
  span.textContent = span_text;
  const strong = document.createElement('strong');
  strong.textContent = strong_text;

  const li = document.createElement('li');
  li.className = 'list-group-item d-flex justify-content-between';
  if (offset) li.className += ' ms-3';
  li.appendChild(span);
  li.appendChild(strong);

  return li;
};

const createRequirementHeaderElement = function (text) {
  const strong = document.createElement('strong');
  strong.textContent = text;

  const li = document.createElement('li');
  li.className = 'list-group-item d-flex justify-content-between';
  li.appendChild(strong);

  return li;
};

const createRewardElement = function (reward_item, repeat, profit) {
  const span = document.createElement('h6');
  span.setAttribute('data-ck-item-id', reward_item.id);
  span.setAttribute('onclick', `open_url('https://universalis.app/market/${reward_item.id}')`);
  span.textContent = reward_item.name + '*' + reward_item.amount * repeat;
  const small = document.createElement('small');
  small.setAttribute('class', 'text-muted');
  small.textContent = reward_item.rate * 100 + '%';
  const div = document.createElement('div');
  div.appendChild(span);
  div.appendChild(small);

  const strong = document.createElement('strong');
  strong.textContent = profit;

  const li = document.createElement('li');
  li.className = 'list-group-item d-flex justify-content-between';
  li.appendChild(div);
  li.appendChild(strong);

  return li;
};

const clear_ui = function () {
  $('.progress-bar').width('0%')
  $('#leve-repeat').text('');
  $('#leve-level').text('');
  $('#leve-patch').text('');
  $('#leve-cost').text('');
  $('#leve-exp').text('');
  $('#leve-require').empty();
  $('#requirements-purchasing-cost').empty();
  $('#requirements-purchasing-cost').append(createRequirementHeaderElement('收购成本'));
  $('#requirements-crafting-cost').empty();
  $('#requirements-crafting-cost').append(createRequirementHeaderElement('制作成本'));
  $('#rewards').empty();
  $('#rewards-expectation').text('');
};

const calculate_purchase = async function (require) {
  let price = await fetchItemPriceHQ(require);
  console.log(`purchase price for ${require.name} is ${price}. need ${require.amount} per leve`);
  return price * require.amount;
};

const update_purchase = function (require, price, repeat, active) {
  const total_amount = require.amount * repeat;
  const total_cost = price * repeat;
  $('#requirements-purchasing-cost').append(createItemElement(require.id, `${require.name}*${total_amount}`, total_cost));
  $('#requirements-purchasing-cost > li:first-child').append(`<strong>${total_cost}</strong>`);
  if (active) $('#requirements-purchasing-cost > li:first-child').addClass('list-group-item-success');
}

/**
 * 
 * @param {*} ingredient 
 * @return price*amont
 */
const calculate_ingredient = async function (ingredient) {
  let price = await fetchItemPriceHQ(ingredient);
  return price * ingredient.amount;
};

/**
 * 
 * @param {*} craft 
 * @param {*} ic 
 * @return craft ingredients and total cost
 */
const calculate_craft = async function (craft, ic) {
  let calc = {
    ingredients: [],
    cost: 0,
  };

  for (let ingredient of craft.ingredients) {
    let cost = await calculate_ingredient(ingredient);
    console.log(`ingredient ${ingredient.name}*${ingredient.amount} purchase price is ${cost}`);

    // cost is total cost
    ingredient.cost = cost;

    // craft it!
    if (('' + ingredient.id) in ic) {
      // note: this is craft calc for 1 peice
      let craft_calc = await calculate_crafts(ic['' + ingredient.id], ic);
      craft_calc.ingredients = craft_calc.ingredients.map((x) => {x.amount *= ingredient.amount; x.cost *= ingredient.amount; return x;});
      craft_calc.cost *= ingredient.amount;
      console.log(`ingredient ${ingredient.name}*${ingredient.amount} craft price is ${craft_calc.cost}`);

      if (craft_calc.cost < cost) {
        console.log(`ingredient ${ingredient.name} is using craft`);

        // update ingredient cost to craft cost
        ingredient.cost = craft_calc.cost;
        // add craft
        ingredient.craft = craft_calc.ingredients;
      }
    }

    calc.ingredients = [...calc.ingredients, ingredient];
    calc.cost += ingredient.cost;
  }

  return calc;
};

const calculate_crafts = async function (crafts, ic) {
  let better = {
    ingredients: [],
    cost: Number.MAX_VALUE,
  }

  for (let craft of crafts) {
    let calc = await calculate_craft(craft, ic);
    if (calc.cost < better.cost) better = calc;
  }

  return better;
}

const update_craft = async function (craft_calc, repeat, active) {
  for (let ingredient of craft_calc.ingredients) {
    const total_amount = ingredient.amount * repeat;
    const total_cost = ingredient.cost * repeat;

    if ('craft' in ingredient) {
      $('#requirements-crafting-cost').append(createItemElement(ingredient.id, ingredient.name + '*' + total_amount, '制作'));

      for (let craft_ingredient of ingredient.craft) {
        const craft_total_amount = craft_ingredient.amount * repeat;
        const craft_total_cost = craft_ingredient.cost * repeat;
        $('#requirements-crafting-cost').append(createItemElement(craft_ingredient.id, craft_ingredient.name + '*' + craft_total_amount, craft_total_cost, true));
      }

      continue;
    }

    $('#requirements-crafting-cost').append(createItemElement(ingredient.id, ingredient.name + '*' + total_amount, total_cost));
  }

  $('#requirements-crafting-cost > li:first-child').append('<strong>' + craft_calc.cost * repeat + '</strong>');
  if (active) $('#requirements-crafting-cost > li:first-child').addClass('list-group-item-success');
};

const updateQuest = function (data, repeat, leve_cost) {
  // update leve quest repeat counter
  $('#leve-repeat').text(repeat);
  // update leve details
  $('#leve-level').text(data.leve.level);
  $('#leve-patch').text(data.leve.patch);
  $('#leve-cost').text(leve_cost);
  $('#leve-exp').text(data.reward.exp);
  // update leve quest requirements
  // leve data without repeat
  $('#leve-require').append(createItemElement(data.require.id, data.require.name, '*' + data.require.amount));
};

const updateCost = async function (data, repeat) {
  // cost data with repeat
  let purchase_cost = await calculate_purchase(data.require);
  let craft_calc = await calculate_crafts(data.craft, data.ic);

  if (purchase_cost > craft_calc.cost) {
    update_purchase(data.require, purchase_cost, repeat, false);
    update_craft(craft_calc, repeat, true);
  } else {
    update_purchase(data.require, purchase_cost, repeat, true);
    update_craft(craft_calc, repeat, false);
  }

  return {
    purchase: purchase_cost,
    craft: craft_calc.cost,
  }
};

const updateReward = async function (cost, reward, repeat, leve_cost) {
  let better_cost = cost.purchase < cost.craft ? cost.purchase : cost.craft;
  // assuming HQ for now. HQ gets doubled gold reward
  let gil = reward.gil * repeat * 2;
  // repeated net profit
  let net = gil - better_cost;

  // profit with math expectation
  let profit_exp = net / repeat;

  for (let item of reward.items) {
    let price = await fetchItemPriceHQ(item);
    let profit = (net + price * item.amount * repeat) / leve_cost;
    $('#rewards').append(createRewardElement(item, repeat, profit));
    profit_exp += price * item.amount * item.rate;
  }

  return profit_exp * repeat / leve_cost;
};

const processLeve = async function (data) {
  // empty all previous progress
  clear_ui();

  // all rewards are calculated based on the repeated times
  const repeat = data.leve.repeat + 1;
  // and leve cost
  const leve_cost = data.leve.is_large ? 10 : 1;

  updateQuest(data, repeat, leve_cost);
  $('.progress-bar').width('20%');

  let cost = await updateCost(data, repeat);
  $('.progress-bar').width('60%')

  let profit_exp = await updateReward(cost, data.reward, repeat, leve_cost);
  $('.progress-bar').width('100%')
  $('#rewards-expectation').text(Math.round(profit_exp));
};

const initSelect = async function (job_id) {
  $('#select-spinner').removeClass('d-none');
  if ($('.guildleve-select').hasClass("select2-hidden-accessible")) {
    $('.guildleve-select').select2('destroy');
    $('.guildleve-select').off('select2:select');
    $('.guildleve-select').html('');
  }
  const resp = await fetchLeveJson(job_id);
  const selectConfig = {
    data: resp,
    width: 'style',
    theme: 'bootstrap4',
  };
  $('.guildleve-select').select2(selectConfig);
  $('#select-spinner').addClass('d-none');
  $('.guildleve-select').on('select2:select', function (e) {
    var data = e.params.data;
    fetchLeveJson(data.id).then((resp) => processLeve(resp));
  });
};

const initListeners = function () {
  $('#job_select').on('click', '*', function () {
    clear_ui();
    const job_id = $(this).attr('id');
    initSelect(job_id);
    $('#job_select > a').removeClass('active');
    $(this).addClass('active');
  });
  $('#server-region').on('change', function (data) {
    const val = data.currentTarget.selectedOptions[0].value;
    serverRegion = val;
    console.log(`change server region to ${val}`);
  });
};

$(function () {
  CafeKitTooltip.initTooltip();
  initListeners();
  clear_ui();
});