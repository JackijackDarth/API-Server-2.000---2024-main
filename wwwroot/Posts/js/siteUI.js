////// Author: Nicolas Chourot
////// 2024
//////////////////////////////

const periodicRefreshPeriod = 2;
const waitingGifTrigger = 2000;
const minKeywordLenth = 3;
const keywordsOnchangeDelay = 500;

let categories = [];
let selectedCategory = "";
let currentETag = "";
let currentPostsCount = -1;
let periodic_Refresh_paused = false;
let postsPanel;
let itemLayout;
let waiting = null;
let showKeywords = false;
let keywordsOnchangeTimger = null;
let loggedUser = null;

loadLoggedUser();
Init_UI();
async function Init_UI() {
  postsPanel = new PageManager(
    "postsScrollPanel",
    "postsPanel",
    "postSample",
    renderPosts
  );
  $("#createPost").on("click", async function () {
    if (loggedUser?.User.isSuper)
    showCreatePostForm();
  });
  $("#abort").on("click", async function () {
    showPosts();
  });
  $("#aboutCmd").on("click", function () {
    showAbout();
  });
  $("#showSearch").on("click", function () {
    toogleShowKeywords();
    showPosts();
  });

  installKeywordsOnkeyupEvent();
  await showPosts();
  start_Periodic_Refresh();
}

/////////////////////////// Search keywords UI //////////////////////////////////////////////////////////

function installKeywordsOnkeyupEvent() {
  $("#searchKeys").on("keyup", function () {
    clearTimeout(keywordsOnchangeTimger);
    keywordsOnchangeTimger = setTimeout(() => {
      cleanSearchKeywords();
      showPosts(true);
    }, keywordsOnchangeDelay);
  });
  $("#searchKeys").on("search", function () {
    showPosts(true);
  });
}
function cleanSearchKeywords() {
  /* Keep only keywords of 3 characters or more */
  let keywords = $("#searchKeys").val().trim().split(" ");
  let cleanedKeywords = "";
  keywords.forEach((keyword) => {
    if (keyword.length >= minKeywordLenth) cleanedKeywords += keyword + " ";
  });
  $("#searchKeys").val(cleanedKeywords.trim());
}
function showSearchIcon() {
  $("#hiddenIcon").hide();
  $("#showSearch").show();
  if (showKeywords) {
    $("#searchKeys").show();
  } else $("#searchKeys").hide();
}
function hideSearchIcon() {
  $("#hiddenIcon").show();
  $("#showSearch").hide();
  $("#searchKeys").hide();
}
function toogleShowKeywords() {
  showKeywords = !showKeywords;
  if (showKeywords) {
    $("#searchKeys").show();
    $("#searchKeys").focus();
  } else {
    $("#searchKeys").hide();
    showPosts(true);
  }
}

/////////////////////////// Views management ////////////////////////////////////////////////////////////

function intialView() {
  if (!loggedUser?.User.isSuper){
    $("#createPost").hide();
    $("#hiddenIcon2").show();
  }
  else{
    $("#hiddenIcon2").hide();
  }
 
  $("#hiddenIcon").hide();
  $("#menu").show();
  $("#commit").hide();
  $("#abort").hide();
  $("#form").hide();
  $("#form").empty();
  $("#aboutContainer").hide();
  $("#errorContainer").hide();
  showSearchIcon();
}
async function showPosts(reset = false) {
  intialView();
  $("#viewTitle").text("Fil de nouvelles");
  periodic_Refresh_paused = false;
  await postsPanel.show(reset);
}
function hidePosts() {
  postsPanel.hide();
  hideSearchIcon();
  $("#createPost").hide();
  $("#menu").hide();
  periodic_Refresh_paused = true;
}
function showForm() {
  hidePosts();
  $("#form").show();
  $("#commit").show();
  $("#abort").show();
}
function showError(message, details = "") {
  hidePosts();
  $("#form").hide();
  $("#form").empty();
  $("#hiddenIcon").show();
  $("#hiddenIcon2").show();
  $("#commit").hide();
  $("#abort").show();
  $("#viewTitle").text("Erreur du serveur...");
  $("#errorContainer").show();
  $("#errorContainer").empty();
  $("#errorContainer").append($(`<div>${message}</div>`));
  $("#errorContainer").append($(`<div>${details}</div>`));
}

function showCreatePostForm() {
  showForm();
  $("#viewTitle").text("Ajout de nouvelle");
  renderPostForm();
}
function showEditPostForm(id) {
  showForm();
  $("#viewTitle").text("Modification");
  renderEditPostForm(id);
}
function showDeletePostForm(id) {
  showForm();
  $("#viewTitle").text("Retrait");
  renderDeletePostForm(id);
}
function showAbout() {
  hidePosts();
  $("#hiddenIcon").show();
  $("#hiddenIcon2").show();
  $("#abort").show();
  $("#viewTitle").text("À propos...");
  $("#aboutContainer").show();
}

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

function start_Periodic_Refresh() {
  $("#reloadPosts").addClass("white");
  $("#reloadPosts").on("click", async function () {
    $("#reloadPosts").addClass("white");
    postsPanel.resetScrollPosition();
    await showPosts();
  });
  setInterval(async () => {
    if (!periodic_Refresh_paused) {
      let etag = await Posts_API.HEAD();
      // the etag contain the number of model records in the following form
      // xxx-etag
      let postsCount = parseInt(etag.split("-")[0]);
      if (currentETag != etag) {
        if (postsCount != currentPostsCount) {
          console.log("postsCount", postsCount);
          currentPostsCount = postsCount;
          $("#reloadPosts").removeClass("white");
        } else await showPosts();
        currentETag = etag;
      }
    }
  }, periodicRefreshPeriod * 1000);
}
async function renderPosts(queryString) {
  let endOfData = false;
  queryString += "&sort=date,desc";
  compileCategories();
  if (selectedCategory != "") queryString += "&category=" + selectedCategory;
  if (showKeywords) {
    let keys = $("#searchKeys").val().replace(/[ ]/g, ",");
    if (keys !== "")
      queryString += "&keywords=" + $("#searchKeys").val().replace(/[ ]/g, ",");
  }
  addWaitingGif();
  let response = await Posts_API.Get(queryString);
  if (!Posts_API.error) {
    currentETag = response.ETag;
    currentPostsCount = parseInt(currentETag.split("-")[0]);
    let Posts = response.data;
    if (Posts.length > 0) {
      Posts.forEach((Post) => {
        renderLikeButton(Post.Id);
        postsPanel.append(renderPost(Post));
      });
    } else endOfData = true;
    linefeeds_to_Html_br(".postText");
    highlightKeywords();
    attach_Posts_UI_Events_Callback();
  } else {
    showError(Posts_API.currentHttpError);
  }
  removeWaitingGif();
  return endOfData;
}
function renderPost(post) {
  console.log("User:", loggedUser);

  let date = convertToFrenchDate(UTC_To_Local(post.Date));
  let crudIconEdit = `
    <span class="editCmd cmdIconSmall fa fa-pencil" postId="${post.Id}" title="Modifier"></span>
  `;
  let crudIconDelete = `
    <span class="deleteCmd cmdIconSmall fa fa-trash" postId="${post.Id}" title="Effacer"></span>
  `;

  let likeIconHTML = `
    <span class="likeCmd fa fa-thumbs-up" postId="${post.Id}" title="Like">
    <span class="likeCount">0</span>
    </span>
  `;
  // ${loggedUser && loggedUser?.User.Id == post.PosterId && loggedUser?.User.isSuper ? crudIconEdit : ""}
  return $(`
    <div class="post" id="${post.Id}">
      <div class="postHeader">
        ${post.Category}
        ${true ? crudIconEdit : ""}
        ${loggedUser && loggedUser?.User.Id == post.PosterId || loggedUser?.User.isAdmin ? crudIconDelete : ""}
        ${loggedUser ? likeIconHTML : ""}
      </div>
      <div class="postTitle">${post.Title}</div>
      <img class="postImage" src='${post.Image}' />
      <div class="postOwnerAndDate">
      <div class="ownerLayout"> 
      <img class="UserAvatarXSmall" src=${post.PosterAvatar}>
      <b>${post.PosterName}</b></div>
      <div class="postDate">${date}</div>
      </div>
      
      <div postId="${post.Id}" class="postTextContainer hideExtra">
        <div class="postText">${post.Text}</div>
      </div>

      <div class="postfooter">
        <span postId="${
          post.Id
        }" class="moreText cmdIconXSmall fa fa-angle-double-down" title="Afficher plus"></span>
        <span postId="${
          post.Id
        }" class="lessText cmdIconXSmall fa fa-angle-double-up" title="Réduire"></span>
      </div>
    </div>
  `);
}

async function compileCategories() {
  categories = [];
  let response = await Posts_API.GetQuery("?fields=category&sort=category");
  if (!Posts_API.error) {
    let items = response.data;
    if (items != null) {
      items.forEach((item) => {
        if (!categories.includes(item.Category)) categories.push(item.Category);
      });
      if (!categories.includes(selectedCategory)) selectedCategory = "";
      updateDropDownMenu(categories);
    }
  }
}

function updateDropDownMenu() {
  let DDMenu = $("#DDMenu");
  let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
  DDMenu.empty();
  if (loggedUser) {
    DDMenu.append(
      $(`
            <div class="dropdown-item" id="loginCmd">
             <img src="${loggedUser.User.Avatar}" class="UserAvatarXSmall" alt="Avatar"> 
             <b>${loggedUser.User.Name}</b>
            </div>
            <div class="dropdown-divider"></div>

            <div class="dropdown-item" id="editprofileCmd">
                    <i class="menuIcon fa fa-user-edit mx-2"></i> Modifier votre profil
                </div>
             <div class="dropdown-item" id="logoutCmd">
                    <i class="menuIcon fa fa-sign-out mx-2"></i> Déconnexion
                </div>
                <div class="dropdown-divider"></div>
            `)
    );
  } else {
    DDMenu.append(
      $(`
            <div class="dropdown-item" id="loginCmd">
                <i class="menuIcon fa fa-sign-in mx-2"></i> Connexion
            </div>
            <div class="dropdown-divider"></div>
            `)
    );
  }
  DDMenu.append(
    $(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `)
  );
  DDMenu.append($(`<div class="dropdown-divider"></div>`));
  categories.forEach((category) => {
    selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
    DDMenu.append(
      $(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `)
    );
  });
  DDMenu.append($(`<div class="dropdown-divider"></div> `));
  DDMenu.append(
    $(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `)
  );
  $("#aboutCmd").on("click", function () {
    showAbout();
  });
  $("#allCatCmd").on("click", async function () {
    selectedCategory = "";
    await showPosts(true);
    updateDropDownMenu();
  });
  $(".category").on("click", async function () {
    selectedCategory = $(this).text().trim();
    await showPosts(true);
    updateDropDownMenu();
  });
  $("#loginCmd").on("click", function () {
    showLoginForm();
  });
  $("#editprofileCmd").on("click", function () {
    showAccountForm();
  });
  $("#logoutCmd").on("click", async function (event) {
    event.preventDefault();
    await Users_API.Logout(loggedUser.User.Id);
    if (!Users_API.error) {
      loggedUser = null;
      localStorage.removeItem("loggedUser");
      await showPosts();
    } else {
      showError("Une erreur est survenue! ", Users_API.currentHttpError);
    }
  });
}

function newUser() {
  let User = {};
  User.Id = 0;
  User.Name = "";
  User.Email = "";
  User.Avatar = "no-avatar.png";
  User.Password = "";
  User.Access_Token = "";
  return User;
}
function showLoginForm() {
  User = newUser();
  hidePosts();
  $("#form").show();
  $("#commit").hide();
  $("#abort").show();
  $("#form").empty();
  $("#viewTitle").text("Créer un utilisateur");

  $("#form").append(`
        <form class="form" id="userForm">
            <div class="form-group">
                <input 
                    type="email"
                    class="form-control"
                    name="Email" 
                    id="Email" 
                    placeholder="Courriel"
                    required
                    RequireMessage="Veuillez entrer un Courriel"
                    InvalidMessage="Le courriel comporte un caractère illégal"
                    value="${User.Email}"
                />
                <div id="emailError" class="form-text text-danger" style="display: none;"></div>
            </div>
            
            <div class="form-group">
                <input
                    type="password"
                    class="form-control"
                    name="Password" 
                    id="Password" 
                    placeholder="Mot de passe"
                    required
                    RequireMessage="Veuillez entrer un Mot de passe"
                    InvalidMessage="Le mot de passe comporte un caractère illégal"
                    value="${User.Password}"
                />
                <div id="passwordError" class="form-text text-danger" style="display: none;"></div>
            </div>
            
            <input type="submit" value="Entrer" id="saveUser" class="btn btn-primary">
            <div class="dropdown-divider"></div>
            <input type="button" value="Nouveau compte" id="newaccCmd" class="btn btn-info">
        </form>
    `);

  $("#userForm").on("submit", async function (event) {
    event.preventDefault();

    // Clear any existing errors
    $("#emailError").hide().text("");
    $("#passwordError").hide().text("");

    let lgnInfo = getFormData($("#userForm"));
    loggedUser = await Users_API.Login(lgnInfo);

    if (!Users_API.error) {
      localStorage.setItem("loggedUser", JSON.stringify(loggedUser));
      if (loggedUser.User.VerifyCode == "unverified") {
        // Handle unverified user case
      }
      await showPosts();
    } else {
      // Display appropriate error messages based on the response
      if (Users_API.currentHttpError === "This user email is not found.") {
        $("#emailError").text("Adresse courriel invalide.").show();
      } else if (Users_API.currentHttpError === "Wrong password.") {
        $("#passwordError").text("Mot de passe invalide.").show();
      } else {
        showError("Une erreur est survenue! ", Users_API.currentHttpError);
      }
    }
  });

  $("#newaccCmd").on("click", function () {
    showAccountForm();
  });
  $("#abort").on("click", async function () {
    await showPosts();
  });
}
function showVerifForm() {
  User = newUser();
  hidePosts();
  $("#form").show();
  $("#commit").hide();
  $("#abort").show();
  $("#form").empty();
  $("#viewTitle").text("Créer un utilisateur");

  $("#form").append(`
          <form class="form" id="userForm">
              <input 
                  class="form-control"
                  name="Email" 
                  id="Email" 
                  placeholder="Code de vérification de courriel"
                  required
                  RequireMessage="Veuillez entrer un code"
                  InvalidMessage="Le courriel comporte un caractère illégal"
              />
            
              <input type="submit" value="Entrer" id="saveUser" class="btn btn-primary">
          </form>
      `);

  $("#userForm").on("submit", async function (event) {
    event.preventDefault();
    let lgnInfo = getFormData($("#userForm"));
    loggedUser = await Users_API.Login(lgnInfo);
    if (!Users_API.error) {
      localStorage.setItem("loggedUser", JSON.stringify(loggedUser));
      if (loggedUser.User.VerifyCode != "verified") {
        showAccountForm();
      }

      await showPosts();
    } else {
      showError("Une erreur est survenue! ", Users_API.currentHttpError);
    }
  });

  $("#newaccCmd").on("click", function () {
    showAccountForm();
  });
  $("#abort").on("click", async function () {
    await showPosts();
  });
}
function showAccountForm() {
  let create = loggedUser == null;
  if (create) user = newUser();
  else user = loggedUser.User;
  hidePosts();
  $("#form").show();
  $("#abort").show();
  $("#form").empty();
  $("#form").append(`
          <form class="form" id="postForm">
              <input type="hidden" name="Id" value="${user.Id}"/>
               <input type="hidden" name="Created" value="${user.Created}"/>
               
               ${
                 !create
                   ? `
                  <input type="hidden" name="Authorizations" value="${
                    loggedUser.User.Authorizations || ""
                  }" />
                  <input type="hidden" name="Access_Token" value="${
                    loggedUser.Access_token || ""
                  }" />
                  <input type="hidden" name="VerifyCode" value="${
                    loggedUser.User.VerifyCode || ""
                  }" />
                `
                   : ""
               }
  
              <div class="mb-2 form-control">
              <label for="Email" class="form-label">Adresse courriel </label>
              <input
                  type="Email"
                  class="mb-2 form-control"
                  name="Email"
                  id="email"
                  placeholder="Courriel"
                  required
                  RequireMessage="Veuillez entrer votre courriel"
                  value="${user.Email}"
              />
              <input 
                  type="Email"
                  class="mb-1 form-control MatchedInput"
                  name="ConfirmEmail" 
                  id="confirmEmail"  placeholder="Vérification"
                  required
                  RequireMessage="Veuillez entrer votre courriel a nouveau"
                  InvalidMessage="Le courriel est different"
                  value="${user.Email}"
                  matchedInputId="email"  />
              </div>
              <div id="emailError" class="form-text text-danger" style="display: none;"></div>
  
                     <div class="mb-2 form-control">
              <label for="Password" class="form-label">Mot de passe </label>
              <input 
                  type="Password"
                  class="mb-2 form-control"
                  name="Password"
                  id="password"
                  placeholder="Mot de passe"  ${
                    !create ? "" : "required"
                  }  RequireMessage="Veuillez entrer un mot de passe"
                  value=""  />
              <input 
                  type="Password"
                  class="mb-1 form-control MatchedInput"
                  name="ConfirmPassword" 
                  id="confirmPassword"  placeholder="Vérification"
                  ${!create ? "" : "required"}
                  RequireMessage="Veuillez entrer votre mot de passe a nouveau"
                  InvalidMessage="Les mots de passe ne correspondent pas"
                  value=""  matchedInputId="password"  />
              </div>
  
                <div class="mb-2 form-control">
              <label for="Name" class="form-label">Nom</label>
              <input 
                  class="mb-2 form-control"
                  name="Name"
                  id="Name"
                  placeholder="Nom"
                  required
                  RequireMessage="Veuillez entrer un mot de passe"
                  value="${user.Name}"
              />
               </div>
  
              <div class="form-control">
              <label class="form-label">Avatar </label>
              <div class='imageUploaderContainer'>
                  <div class='imageUploader' 
                       newImage='${create}' 
                       controlId='Avatar' 
                       imageSrc='${user.Avatar}' 
                       waitingImage="Loading_icon.gif">
                  </div>
              </div>
              </div>
  
              <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary">
              <input type="submit" value="Annuler" id="cancel" class="btn btn-secondary">
          </form>
      `);

  initImageUploaders();
  initFormValidation();

  $("#commit").click(function () {
    $("#commit").off();
    return $("#savePost").trigger("click");
  });
  $("#postForm").on("submit", async function (event) {
    $("#emailError").hide().text("");
    // addConflictValidation("http://localhost:5000/accounts/conflict","Email","savePost")
    event.preventDefault();
    const confirmEmail = $("#confirmEmail");
    const confirmPassword = $("#confirmPassword");
    confirmEmail.remove();
    confirmPassword.remove();
    let user = getFormData($("#postForm"));
    if (!create) {
      if (user.Email && user.Email.trim()) {
        loggedUser.User.Email = user.Email;
      }
      if (user.Name && user.Name.trim()) {
        loggedUser.User.Name = user.Name;
      }
      if (user.Avatar && user.Avatar.trim()) {
        loggedUser.User.Avatar = user.Avatar;
      }
    }

    if (create) user.Created = Local_to_UTC(Date.now());
    userr = await Users_API.Save(user, create);
    console.log(userr);
    if (!Users_API.error) {
      if (!create)
        localStorage.setItem("loggedUser", JSON.stringify(loggedUser));
      await showPosts();
    }
    if (Users_API.currentHttpError === "Unicity conflict on [Email]...") {
      $("#emailError").text("Adresse courriel invalide.").show();
    }
    // else {
    //     showError("Une erreur est survenue! ", Users_API.currentHttpError);
    // }
  });
  $("#cancel").on("click", async function () {
    await showLoginForm();
  });
}

function attach_Posts_UI_Events_Callback() {
  linefeeds_to_Html_br(".postText");

  // Hide icons based on user status
  // if (!loggedUser) {
  //   $(".likeCmd").hide();
  // }
  // if (!loggedUser?.User?.isAdmin) {
  //   $(".editCmd").hide();
  //   $(".deleteCmd").hide();
  // }

  // Attach event handlers for edit and delete commands
  $(".editCmd")
    .off()
    .on("click", function () {
      showEditPostForm($(this).attr("postId"));
    });
  $(".deleteCmd")
    .off()
    .on("click", function () {
      showDeletePostForm($(this).attr("postId"));
    });

  // Expand or collapse post text
  $(".moreText")
    .off()
    .click(function () {
      const postId = $(this).attr("postId");
      $(`.commentsPanel[postId=${postId}]`).show();
      $(`.lessText[postId=${postId}]`).show();
      $(this).hide();
      $(`.postTextContainer[postId=${postId}]`)
        .addClass("showExtra")
        .removeClass("hideExtra");
    });

  $(".lessText")
    .off()
    .click(function () {
      const postId = $(this).attr("postId");
      $(`.commentsPanel[postId=${postId}]`).hide();
      $(`.moreText[postId=${postId}]`).show();
      $(this).hide();
      postsPanel.scrollToElem(postId);
      $(`.postTextContainer[postId=${postId}]`)
        .addClass("hideExtra")
        .removeClass("showExtra");
    });

  $(".likeCmd").on("click", async function (event) {
    if (loggedUser) {
      event.preventDefault();
      const postId = $(this).attr("postId");
      const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));
      const userId = loggedUser?.User?.Id;
      const name = loggedUser?.User?.Name;

      try {
        const likes = await Likes_API.Get();

        let hasLiked = false;
        let postLikes = [];
        let userlike = [];
        let usernames = [];

        for (const like of likes.data) {
          if (like.PostId === postId) {
            postLikes.push(like);
            if (like.UserId === userId) {
              hasLiked = true;
              userlike = like;
            }
          }
        }
        console.log(postLikes);
        console.log(usernames);
        if (hasLiked) {
          console.log("il a like! Delete " + userlike.Id);
          await Likes_API.Delete(userlike.Id);
        } else {
          const likeData = {
            UserId: userId,
            PostId: postId,
            Name: name,
          };

          await Likes_API.Save(likeData);
        }

        await renderLikeButton(postId);
      } catch (error) {
        console.error("Erreur lors du Like/Unlike :", error);
      }
    }
  });
}

function addWaitingGif() {
  clearTimeout(waiting);
  waiting = setTimeout(() => {
    postsPanel.itemsPanel.append(
      $(
        "<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"
      )
    );
  }, waitingGifTrigger);
}
function removeWaitingGif() {
  clearTimeout(waiting);
  $("#waitingGif").remove();
}

/////////////////////// Posts content manipulation ///////////////////////////////////////////////////////

function linefeeds_to_Html_br(selector) {
  $.each($(selector), function () {
    let postText = $(this);
    var str = postText.html();
    var regex = /[\r\n]/g;
    postText.html(str.replace(regex, "<br>"));
  });
}
function highlight(text, elem) {
  text = text.trim();
  if (text.length >= minKeywordLenth) {
    var innerHTML = elem.innerHTML;
    let startIndex = 0;

    while (startIndex < innerHTML.length) {
      var normalizedHtml = innerHTML
        .toLocaleLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      var index = normalizedHtml.indexOf(text, startIndex);
      let highLightedText = "";
      if (index >= startIndex) {
        highLightedText =
          "<span class='highlight'>" +
          innerHTML.substring(index, index + text.length) +
          "</span>";
        innerHTML =
          innerHTML.substring(0, index) +
          highLightedText +
          innerHTML.substring(index + text.length);
        startIndex = index + highLightedText.length + 1;
      } else startIndex = innerHTML.length + 1;
    }
    elem.innerHTML = innerHTML;
  }
}
function highlightKeywords() {
  if (showKeywords) {
    let keywords = $("#searchKeys").val().split(" ");
    if (keywords.length > 0) {
      keywords.forEach((key) => {
        let titles = document.getElementsByClassName("postTitle");
        Array.from(titles).forEach((title) => {
          highlight(key, title);
        });
        let texts = document.getElementsByClassName("postText");
        Array.from(texts).forEach((text) => {
          highlight(key, text);
        });
      });
    }
  }
}

//////////////////////// Forms rendering /////////////////////////////////////////////////////////////////

async function renderEditPostForm(id) {
  $("#commit").show();
  addWaitingGif();
  let response = await Posts_API.Get(id);
  if (!Posts_API.error) {
    let Post = response.data;
    if (Post !== null) renderPostForm(Post);
    else showError("Post introuvable!");
  } else {
    showError(Posts_API.currentHttpError);
  }
  removeWaitingGif();
}
async function renderDeletePostForm(id) {
  let response = await Posts_API.Get(id);
  if (!Posts_API.error) {
    let post = response.data;
    if (post !== null) {
      let date = convertToFrenchDate(UTC_To_Local(post.Date));
      $("#form").append(`
                <div class="post" id="${post.Id}">
                <div class="postHeader">  ${post.Category} </div>
                <div class="postTitle ellipsis"> ${post.Title} </div>
                <img class="postImage" src='${post.Image}'/>
                <div class="postDate"> ${date} </div>
                <div class="postTextContainer showExtra">
                    <div class="postText">${post.Text}</div>
                </div>
            `);
      linefeeds_to_Html_br(".postText");
      // attach form buttons click event callback
      $("#commit").on("click", async function () {
        await Posts_API.Delete(post.Id);
        if (!Posts_API.error) {
          await showPosts();
        } else {
          console.log(Posts_API.currentHttpError);
          showError("Une erreur est survenue!");
        }
      });
      $("#cancel").on("click", async function () {
        await showPosts();
      });
    } else {
      showError("Post introuvable!");
    }
  } else showError(Posts_API.currentHttpError);
}
function newPost() {
  let Post = {};
  Post.Id = 0;
  Post.Title = "";
  Post.Text = "";
  Post.Image = "news-logo-upload.png";
  Post.Category = "";
  Post.PosterName = "";
  Post.PosterAvatar = "";
  Post.PosterId = "";
  return Post;
}
function renderPostForm(post = null) {
  let create = post == null;
  if (create) post = newPost();
  $("#form").show();
  $("#form").empty();
  $("#form").append(`
        <form class="form" id="postForm">
            <input type="hidden" name="Id" value="${post.Id}"/>
             <input type="hidden" name="PosterName" value="${loggedUser.User.Name}"/>
             <input type="hidden" name="PosterAvatar" value="${loggedUser.User.Avatar}"/>
             <input type="hidden" name="PosterId" value="${loggedUser.User.Id}"/>
             <input type="hidden" name="Date" value="${post.Date}"/>
            <label for="Category" class="form-label">Catégorie </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${post.Category}"
            />
            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${post.Title}"
            />
            <label for="Url" class="form-label">Texte</label>
             <textarea class="form-control" 
                          name="Text" 
                          id="Text"
                          placeholder="Texte" 
                          rows="9"
                          required 
                          RequireMessage = 'Veuillez entrer une Description'>${post.Text}</textarea>

            <label class="form-label">Image </label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader' 
                     newImage='${create}' 
                     controlId='Image' 
                     imageSrc='${post.Image}' 
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
            <div id="keepDateControl">
                <input type="checkbox" name="keepDate" id="keepDate" class="checkbox" checked>
                <label for="keepDate"> Conserver la date de création </label>
            </div>
            <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary displayNone">
        </form>
    `);
  if (create) $("#keepDateControl").hide();

  initImageUploaders();
  initFormValidation(); // important do to after all html injection!

  $("#commit").click(function () {
    $("#commit").off();
    return $("#savePost").trigger("click");
  });
  $("#postForm").on("submit", async function (event) {
    event.preventDefault();
    let post = getFormData($("#postForm"));
    if (post.Category != selectedCategory) selectedCategory = "";
    if (create || !("keepDate" in post)) post.Date = Local_to_UTC(Date.now());
    delete post.keepDate;
    post = await Posts_API.Save(post, create);
    if (!Posts_API.error) {
      await showPosts();
      postsPanel.scrollToElem(post.Id);
    } else showError("Une erreur est survenue! ", Posts_API.currentHttpError);
  });
  $("#cancel").on("click", async function () {
    await showPosts();
  });
}
function getFormData($form) {
  // prevent html injections
  const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
  var jsonObject = {};
  // grab data from all controls
  $.each($form.serializeArray(), (index, control) => {
    jsonObject[control.name] = control.value.replace(removeTag, "");
  });
  return jsonObject;
}
function loadLoggedUser() {
  const storedUser = localStorage.getItem("loggedUser");
  if (storedUser) {
    loggedUser = JSON.parse(storedUser);
    console.log("User loaded from localStorage:", loggedUser);
  } else {
    loggedUser = null;
  }
}
async function renderLikeButton(postId) {
  try {
    const likes = await Likes_API.Get();
    console.log(likes);

    let postLikes = [];
    let hasLiked = false;
    let usernames = [];
    const userId = loggedUser?.User?.Id;

    for (const like of likes.data) {
      if (like.PostId === postId) {
        postLikes.push(like);
        usernames.push(like.Name);
        if (like.UserId === userId) {
          hasLiked = true;
        }
      }
    }

    const nblike = postLikes.length;
    console.log(usernames);

    const likeButton = $(`.likeCmd[postid="${postId}"]`);
    likeButton.css("color", hasLiked ? "blue" : "gray");

    likeButton.children(".likeCount").text(nblike);

    likeButton.attr("title", usernames.join(", "));
    likeButton.tooltip();
  } catch (error) {
    console.error(`Erreur pour Like Post ${postId}:`, error);
  }
}
