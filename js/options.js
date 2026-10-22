/* What a customer can choose when they open an item.
   Edit this file to change the choices. You never need to touch app.js.

   Each rule says WHICH items it applies to and WHICH groups of choices to show.
   The first rule that matches is used.

   match.category   a word from the category name, for example /ribs/i
   match.product    a word from the item name, for example /brisket/i  (use both to be more exact)

   Each group has:
     label      the heading shown to the customer
     type       "single" = pick one,  "multi" = pick any number
     required   true = one choice is always selected
     choices    a list of choices. There are two kinds:

       { label: "Spicy" }       a free choice. It costs nothing and goes to the kitchen as a note.
       { item: "Fries" }        an extra from YOUR MENU. It is added to the cart as its own item,
                                with the price from your menu, so the total is always correct.
                                The name must match an item on your menu (it is not case sensitive).
                                If no item with that name exists, the choice is simply hidden.

   Extras are added once for every item ordered. Two burgers with Fries gives two Fries.
   Items with no matching rule still open the same page, just without choices. */
const PRODUCT_OPTIONS = [
  {
    match: { category: /burger|sandwich|bbq|pulled/i },
    groups: [
      { label: "Pick a sauce", type: "single", required: true,
        choices: [{ label: "Original" }, { label: "Sweet and smoky" }, { label: "Hot" }] },
      { label: "Add a side", type: "multi",
        choices: [{ item: "Fries" }, { item: "Coleslaw" }, { item: "Mac and cheese" }, { item: "Soft drink" }] },
      { label: "Leave out", type: "multi",
        choices: [{ label: "No pickles" }, { label: "No onions" }, { label: "No sauce" }] },
    ],
  },
  {
    match: { category: /plate|platter|ribs|brisket|meat/i },
    groups: [
      { label: "Sauce", type: "single", required: true,
        choices: [{ label: "Sauce on the meat" }, { label: "Sauce on the side" }, { label: "No sauce" }] },
      { label: "Extras", type: "multi",
        choices: [{ item: "Cornbread" }, { item: "Coleslaw" }, { item: "Mac and cheese" }, { item: "Soft drink" }] },
    ],
  },
  {
    match: { category: /wing|chicken/i },
    groups: [
      { label: "How hot?", type: "single", required: true,
        choices: [{ label: "Mild" }, { label: "Medium" }, { label: "Hot" }] },
      { label: "Extras", type: "multi",
        choices: [{ item: "Fries" }, { item: "Soft drink" }] },
    ],
  },
  {
    match: { category: /drink|soda|beverage/i },
    groups: [
      { label: "Ice", type: "single", required: true,
        choices: [{ label: "With ice" }, { label: "No ice" }] },
    ],
  },
];
